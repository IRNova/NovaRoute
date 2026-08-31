// Nova agent system tools — part 2: code sandbox, file operations, web fetch.
// Ported from Hermes Agent capabilities, adapted to NovaRoute's approval model.
//
// code   : JS execution in node:vm isolate (no require/process/network).
// files  : read/list free inside allowed roots; write/edit need admin approval.
// web    : server-side URL fetch → text, with SSRF guard.

import vm from "node:vm";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { createPendingApproval, waitForDecision } from "./tools.js";
import { secretsWarning } from "./tirith.js";

const FILE_MAX_BYTES = 200_000;
const FETCH_MAX_BYTES = 8_000;

const ALLOWED_ROOTS = [
  process.cwd(),
  "/tmp",
  "/var/log",
];

function isPathAllowed(p) {
  if (!p) return false;
  const abs = p.startsWith("/") ? p : `${process.cwd()}/${p}`;
  return ALLOWED_ROOTS.some((root) => abs === root || abs.startsWith(root + "/"));
}

/* ── SSRF guard (shared with browser navigate) ─────────────────────── */

// Implementation lives in @/lib/security/urlGuard.js so it can be unit-tested
// without pulling the whole agent stack in. Re-exported for existing callers.
export { isUrlSafe, isUrlSafeResolved, fetchSafely, isPrivateAddress, parseIpv4 } from "@/lib/security/urlGuard.js";
import { fetchSafely } from "@/lib/security/urlGuard.js";

/* ── Code sandbox (Hermes-style isolated VM) ───────────────────────── */

// Everything the user code touches must belong to the VM context. The previous
// version handed host objects in (console, Math, JSON, …) and a host object is
// a way straight back out: `Math.constructor.constructor("return process")()`
// rebuilds Function in the HOST realm and from there `process` — and a root
// shell — are one line away. So the context gets nothing but a source string,
// and the bridge back is a JSON string, never a live object.
//
// This is a hardening pass, not a jail: node:vm is not a security boundary
// (see docs). Treat the `code` tool as "runs as the server user" and keep it
// off agents that read untrusted input, or swap in isolated-vm.
const SANDBOX_BOOTSTRAP = `
  var __logs = [];
  function __fmt(a) {
    if (typeof a === "string") return a;
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }
  function __push() {
    if (__logs.length >= 100) return;
    __logs.push(Array.prototype.map.call(arguments, __fmt).join(" "));
  }
  var console = { log: __push, error: __push, warn: __push, info: __push };
`;

const SANDBOX_RUNNER = `
  (function () {
    var out;
    try {
      out = (0, eval)(__code);
    } catch (e) {
      return JSON.stringify({ error: String((e && e.message) || e), logs: __logs });
    }
    var shown = null;
    if (out !== undefined) {
      try { shown = typeof out === "string" ? out : JSON.stringify(out, null, 1); }
      catch (e) { shown = String(out); }
    }
    return JSON.stringify({ result: shown, logs: __logs });
  })()
`;

function executeCode(code) {
  let parsed;
  try {
    const context = vm.createContext({ __code: String(code) });
    vm.runInContext(SANDBOX_BOOTSTRAP, context, { timeout: 1_000 });
    const raw = vm.runInContext(SANDBOX_RUNNER, context, { timeout: 3_000 });
    parsed = JSON.parse(String(raw));
  } catch (e) {
    return `ERROR: ${String(e?.message || e).slice(0, 400)}`;
  }

  const logs = Array.isArray(parsed.logs) ? parsed.logs.map(String) : [];
  if (parsed.error) {
    return `ERROR: ${String(parsed.error).slice(0, 400)}${logs.length ? `\n--- output before error ---\n${logs.join("\n")}` : ""}`;
  }

  let out = "";
  if (logs.length) out += `console:\n${logs.join("\n")}\n`;
  if (parsed.result !== null && parsed.result !== undefined) {
    out += `=> ${String(parsed.result).slice(0, 4_000)}`;
  } else if (!logs.length) {
    out = "(ran, no output)";
  }
  return out.slice(0, 6_000);
}

/* ── File operations ───────────────────────────────────────────────── */

async function fileRead(p) {
  if (!isPathAllowed(p)) return "ERROR: path outside allowed roots.";
  try {
    const st = await stat(p);
    if (st.isDirectory()) return "ERROR: path is a directory, use list.";
    if (st.size > FILE_MAX_BYTES) return `ERROR: file too large (${st.size} bytes, max ${FILE_MAX_BYTES}).`;
    const buf = await readFile(p);
    // crude binary sniff
    let nonText = 0;
    for (const b of buf.subarray(0, 1024)) { if (b === 0 || (b < 9 && b !== 7)) nonText++; }
    if (nonText > 8) return `(binary file, ${st.size} bytes)`;
    return buf.toString("utf8").slice(0, FILE_MAX_BYTES);
  } catch (e) {
    return `ERROR: ${e?.code === "ENOENT" ? "file not found" : String(e?.message || e).slice(0, 200)}`;
  }
}

async function fileList(p) {
  if (!isPathAllowed(p)) return "ERROR: path outside allowed roots.";
  try {
    const entries = await readdir(p, { withFileTypes: true });
    const lines = [];
    for (const e of entries.slice(0, 300)) {
      const kind = e.isDirectory() ? "dir " : "file";
      let size = "";
      if (e.isFile()) {
        try { size = String((await stat(`${p.replace(/\/$/, "")}/${e.name}`)).size); } catch {}
      }
      lines.push(`${kind}  ${size.padStart(10)}  ${e.name}`);
    }
    return lines.length ? lines.join("\n") : "(empty directory)";
  } catch (e) {
    return `ERROR: ${e?.code === "ENOENT" ? "directory not found" : String(e?.message || e).slice(0, 200)}`;
  }
}

async function requestWriteApproval({ op, filePath, contentPreview }, meta) {
  const item = await createPendingApproval({
    command: `[${op}] ${filePath}${secretsWarning(op === "write" ? String(contentPreview.length) : `${contentPreview.from}\n${contentPreview.to}`)}${op === "edit" ? `\n<<<\n${contentPreview.from}\n>>>\n${contentPreview.to}` : op === "write" ? `\n(${contentPreview.length} chars)` : ""}`,
    agentName: meta.agentName,
    sessionId: meta.sessionId,
  });
  meta.onEvent?.({ type: "approval", id: item.id, command: `[${op}] ${filePath}`, agentName: item.agentName });
  return item.id;
}

// Re-use terminal's decision plumbing via exported waitForDecision.

async function fileWrite(p, content, meta) {
  if (!isPathAllowed(p)) return "ERROR: path outside allowed roots.";
  const id = await requestWriteApproval({ op: "write", filePath: p, contentPreview: { length: String(content).length } }, meta);
  const ok = await waitForDecision(id);
  if (!ok) return "DENIED: admin did not approve this write.";
  try {
    await writeFile(p, String(content), "utf8");
    return `Written: ${p} (${String(content).length} chars)`;
  } catch (e) {
    return `ERROR: ${String(e?.message || e).slice(0, 200)}`;
  }
}

async function fileEdit(p, from, to, meta) {
  if (!isPathAllowed(p)) return "ERROR: path outside allowed roots.";
  let current;
  try {
    current = await readFile(p, "utf8");
  } catch (e) {
    return `ERROR: cannot read target (${e?.code === "ENOENT" ? "not found" : String(e?.message || e).slice(0, 150)})`;
  }
  if (!current.includes(from)) return "ERROR: search text not found in file — nothing edited.";
  const id = await requestWriteApproval({ op: "edit", filePath: p, contentPreview: { from: String(from).slice(0, 300), to: String(to).slice(0, 300) } }, meta);
  const ok = await waitForDecision(id);
  if (!ok) return "DENIED: admin did not approve this edit.";
  try {
    await writeFile(p, current.replace(from, to), "utf8");
    return `Edited: ${p}`;
  } catch (e) {
    return `ERROR: ${String(e?.message || e).slice(0, 200)}`;
  }
}

/* ── Web fetch ─────────────────────────────────────────────────────── */

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function webFetch(url, maxLength) {
  if (!/^https?:\/\//i.test(url)) return "ERROR: url must be absolute (http/https).";
  let res, body;
  try {
    ({ res } = await fetchSafely(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; NovaBot/1.0)" },
    }));
    body = await res.text();
  } catch (e) {
    return `ERROR: fetch failed (${String(e?.message || e).slice(0, 200)})`;
  }
  if (res.statusCode >= 400) return `ERROR: HTTP ${res.statusCode}.`;
  const ct = String(res.headers?.["content-type"] || "");
  const text = /html?/i.test(ct) ? htmlToText(body) : body;
  const limit = Math.min(Number.parseInt(maxLength, 10) || FETCH_MAX_BYTES, 20_000);
  return `URL: ${url}\nStatus: ${res.statusCode}\n---\n${text.length <= limit ? text : text.slice(0, limit) + `\n... [truncated, total ${text.length} chars]`}`;
}

/* ── Tool definitions & dispatcher ---------------------------------- */

export function buildExtendedToolDefinitions(agent) {
  const tools = String(agent?.tools || "").split(",").map((t) => t.trim());
  const defs = [];

  if (tools.includes("code")) {
    defs.push({
      type: "function",
      function: {
        name: "code",
        description:
          "Execute JavaScript in a secure sandbox (isolated VM: no filesystem, no network, no require/process; 3s timeout; console.log captured). Use to compute, parse, transform data or verify logic.",
        parameters: {
          type: "object",
          properties: { code: { type: "string", description: "JavaScript source to run." } },
          required: ["code"],
        },
      },
    });
  }

  if (tools.includes("files")) {
    defs.push({
      type: "function",
      function: {
        name: "files",
        description:
          "File operations on the server (allowed roots: app directory, /tmp, /var/log). Actions: read (path), list (path), write (path+content; needs admin approval), edit (path+from+to exact replace; needs admin approval).",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["read", "list", "write", "edit"] },
            path: { type: "string", description: "Absolute path" },
            content: { type: "string", description: "New content (write)" },
            from: { type: "string", description: "Exact existing text (edit)" },
            to: { type: "string", description: "Replacement text (edit)" },
          },
          required: ["action", "path"],
        },
      },
    });
  }

  if (tools.includes("web")) {
    defs.push({
      type: "function",
      function: {
        name: "web_fetch",
        description:
          "Fetch a public web page server-side and return readable text (HTML stripped, truncated). For JS-heavy sites prefer the browser tool. Private/internal URLs are blocked.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "Absolute http(s) URL" },
            max_length: { type: "integer", description: "Max characters returned (default 8000, max 20000)" },
          },
          required: ["url"],
        },
      },
    });
  }

  return defs;
}

export async function executeExtendedToolCall(call, meta = {}) {
  const name = call?.function?.name;
  let args = {};
  try {
    args = JSON.parse(call?.function?.arguments || "{}");
  } catch {
    return "ERROR: invalid tool arguments (not valid JSON).";
  }

  const has = (t) => String(meta.agent?.tools || "").split(",").map((x) => x.trim()).includes(t);

  try {
    if (name === "code") {
      if (!has("code")) return "ERROR: this agent has no code access.";
      return executeCode(args?.code);
    }
    if (name === "files") {
      if (!has("files")) return "ERROR: this agent has no files access.";
      switch (String(args?.action || "")) {
        case "read": return await fileRead(String(args?.path || ""));
        case "list": return await fileList(String(args?.path || ""));
        case "write": return await fileWrite(String(args?.path || ""), args?.content ?? "", meta);
        case "edit": return await fileEdit(String(args?.path || ""), String(args?.from ?? ""), String(args?.to ?? ""), meta);
        default: return 'ERROR: unknown action (use read/list/write/edit).';
      }
    }
    if (name === "web_fetch") {
      if (!has("web")) return "ERROR: this agent has no web access.";
      return await webFetch(String(args?.url || ""), args?.max_length);
    }
    return null; // not ours — let core dispatcher handle
  } catch (e) {
    return `ERROR: ${String(e?.message || e).slice(0, 400)}`;
  }
}
