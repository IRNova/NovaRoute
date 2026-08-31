// Nova Bot — final agent tools: web_search, video_gen, osv_check.
// web_search: DuckDuckGo HTML scrape (no API key). video_gen: through the
// local gateway's /v1/videos/generations (reuses configured providers).
// osv_check: Google OSV vulnerability database (free public API).

import { getApiKeys } from "@/lib/localDb";
import * as integ from "./integrations.js";
import * as wt from "./worktrees.js";
import * as term from "./terminals.js";

let _base = null;
function gwBase() {
  if (_base) return _base;
  _base = `http://127.0.0.1:${process.env.PORT || 20128}`;
  return _base;
}

async function gwPost(route, body, timeoutMs = 300_000) {
  const keys = await getApiKeys();
  const key = (Array.isArray(keys) ? keys : []).find((k) => k.enabled !== false)?.key;
  if (!key) throw new Error("no gateway API key configured");
  const res = await fetch(gwBase() + route, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.statusCode}`);
  return json;
}

/* ── Web search (DuckDuckGo HTML) ──────────────────────────────────── */

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function ddgSearch(query, limit) {
  // lite.duckduckgo.com returns simple table rows that parse reliably.
  const res = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0 (compatible; NovaBot/1.0)" },
    body: new URLSearchParams({ q: String(query).slice(0, 400) }).toString(),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status >= 400) throw new Error(`DDG HTTP ${res.status}`);
  const html = await res.text();

  const results = [];
  const linkRe = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snipRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
  const snippets = [];
  let sm;
  while ((sm = snipRe.exec(html))) snippets.push(decodeEntities(sm[1].replace(/<[^>]+>/g, " ")).trim());
  let lm;
  while ((lm = linkRe.exec(html))) {
    let href = lm[1];
    // DDG wraps URLs: //duckduckgo.com/l/?uddg=<encoded>&rut=...
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) href = decodeURIComponent(m[1]);
    results.push({
      title: decodeEntities(lm[2].replace(/<[^>]+>/g, " ")).trim(),
      url: href,
      snippet: snippets[results.length] || "",
    });
    if (results.length >= limit) break;
  }
  return results;
}

export async function webSearch({ query, max_results }) {
  if (!String(query || "").trim()) throw new Error("empty query");
  const limit = Math.min(Math.max(parseInt(max_results, 10) || 6, 1), 10);
  let items = [];
  try {
    items = await ddgSearch(query, limit);
  } catch (e) {
    return `ERROR: search failed (${String(e?.message || e).slice(0, 150)})`;
  }
  if (!items.length) return "No results found.";
  return items
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet.slice(0, 200)}` : ""}`)
    .join("\n");
}

/* ── Video generation (gateway route already exists) ───────────────── */

export async function videoGen({ prompt, model, seconds }) {
  const json = await gwPost("/v1/videos/generations", {
    ...(model ? { model } : {}),
    prompt: String(prompt || "").slice(0, 3000),
    ...(seconds ? { seconds } : {}),
  });
  const url = json?.data?.[0]?.url || json?.url || json?.video_url;
  if (url) return `Video URL: ${url}`;
  if (json?.status) return `Video job status: ${json.status}${json.id ? ` (id: ${json.id})` : ""}`;
  return `Response: ${JSON.stringify(json).slice(0, 500)}`;
}

/* ── OSV vulnerability check ───────────────────────────────────────── */

export async function osvCheck({ package_name, ecosystem, version }) {
  if (!String(package_name || "").trim()) throw new Error("package_name required");
  const res = await fetch("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      package: { name: String(package_name), ecosystem: String(ecosystem || "npm") },
      ...(version ? { version: String(version) } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OSV HTTP ${res.statusCode}`);
  const vulns = json?.vulns || [];
  if (!vulns.length) return `✅ No known vulnerabilities for ${package_name}.`;
  return vulns.slice(0, 8).map((v) =>
    `🔴 ${v.id} (${(v.severity || []).map((s) => s.score).join(",") || "severity?"})\n   ${String(v.summary || v.details || "").slice(0, 180)}\n   ${v.references?.[0]?.url || ""}`
  ).join("\n\n") + `\n(${vulns.length} total)`;
}

// ── Extended tool set: async / worktree / sessions / integrations ──

export function buildFinalToolDefinitions(agent) {
  const has = (t) => String(agent?.tools || "").split(",").map((x) => x.trim()).includes(t);
  const defs = [];

  if (has("async")) {
    defs.push({ type: "function", function: { name: "delegate_async", description: "Start a task for an employee WITHOUT waiting: they work in the background; keep chatting and poll with async_status.", parameters: { type: "object", properties: { agent_name: { type: "string" }, instruction: { type: "string" } }, required: ["agent_name", "instruction"] } } });
    defs.push({ type: "function", function: { name: "async_status", description: "List recent background tasks and their status/result preview.", parameters: { type: "object", properties: {} } } });
  }
  if (has("worktree")) {
    defs.push({ type: "function", function: { name: "wt_create", description: "Create an isolated git worktree at /tmp/nova-wt/<name> on branch nova/<name> (needs admin approval).", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } });
    defs.push({ type: "function", function: { name: "wt_cmd", description: "Run a shell command inside a worktree directory (approval-gated).", parameters: { type: "object", properties: { name: { type: "string" }, command: { type: "string" } }, required: ["name", "command"] } } });
    defs.push({ type: "function", function: { name: "wt_diff", description: "Show git diff (stat + patch) of a worktree vs HEAD.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } });
    defs.push({ type: "function", function: { name: "wt_remove", description: "Remove a worktree and its branch (approval-gated).", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } });
  }
  if (has("terminal")) {
    defs.push({ type: "function", function: { name: "term_open", description: "Open a persistent bash session (state/env/cd persist between commands; approval-gated). Not for full-screen apps.", parameters: { type: "object", properties: { name: { type: "string" }, cwd: { type: "string" } } } } });
    defs.push({ type: "function", function: { name: "term_write", description: "Write a command into a persistent session (approval-gated) and read early output.", parameters: { type: "object", properties: { session: { type: "string" }, command: { type: "string" } }, required: ["command"] } } });
    defs.push({ type: "function", function: { name: "term_read", description: "Read recent output buffer of a session.", parameters: { type: "object", properties: { session: { type: "string" } } } } });
    defs.push({ type: "function", function: { name: "term_close", description: "Close a persistent session.", parameters: { type: "object", properties: { session: { type: "string" } } } } });
  }
  if (has("web")) {
    defs.push({ type: "function", function: { name: "web_search", description: "Search the public web (DuckDuckGo) and return top results with URLs/snippets. Pair with web_fetch to read a result.", parameters: { type: "object", properties: { query: { type: "string" }, max_results: { type: "integer" } }, required: ["query"] } } });
  }
  if (has("video_gen")) {
    defs.push({ type: "function", function: { name: "video_gen", description: "Generate a short video from a text prompt via the gateway video provider.", parameters: { type: "object", properties: { prompt: { type: "string" }, model: { type: "string" }, seconds: { type: "integer" } }, required: ["prompt"] } } });
  }
  if (has("osv")) {
    defs.push({ type: "function", function: { name: "osv_check", description: "Check an npm/pip package version against the OSV vulnerability database.", parameters: { type: "object", properties: { package_name: { type: "string" }, ecosystem: { type: "string" }, version: { type: "string" } }, required: ["package_name"] } } });
  }
  if (has("gdrive")) {
    defs.push({ type: "function", function: { name: "drive_list", description: "List Google Drive files (optional query).", parameters: { type: "object", properties: { query: { type: "string" }, max: { type: "integer" } } } } });
    defs.push({ type: "function", function: { name: "drive_read", description: "Read/export a Google Drive file as text.", parameters: { type: "object", properties: { file_id: { type: "string" } }, required: ["file_id"] } } });
    defs.push({ type: "function", function: { name: "drive_search", description: "Find Drive files by name substring.", parameters: { type: "object", properties: { query: { type: "string" }, max: { type: "integer" } }, required: ["query"] } } });
  }
  if (has("homeassistant")) {
    defs.push({ type: "function", function: { name: "ha_states", description: "List Home Assistant entity states or fetch one entity.", parameters: { type: "object", properties: { entity_id: { type: "string" } } } } });
    defs.push({ type: "function", function: { name: "ha_call", description: "Call a Home Assistant service (e.g. light/turn_on). Approval-free but audited by HA itself.", parameters: { type: "object", properties: { domain: { type: "string" }, service: { type: "string" }, entity_id: { type: "string" }, data: { type: "object" } }, required: ["domain", "service"] } } });
  }
  if (has("x_search")) {
    defs.push({ type: "function", function: { name: "x_search", description: "Live search posts on X (Twitter) via xAI Grok with citations.", parameters: { type: "object", properties: { query: { type: "string" }, max_results: { type: "integer" } }, required: ["query"] } } });
  }
  if (has("github")) {
    const ghRepo = { owner: { type: "string" }, repo: { type: "string" } };
    const ghRepoReq = ["owner", "repo"];
    defs.push({ type: "function", function: { name: "gh_list_repos", description: "List the connected GitHub user's repositories.", parameters: { type: "object", properties: { repo_type: { type: "string" }, sort: { type: "string" }, per_page: { type: "integer" } } } } });
    defs.push({ type: "function", function: { name: "gh_get_repo", description: "Get details of a specific GitHub repository.", parameters: { type: "object", properties: ghRepo, required: ghRepoReq } } });
    defs.push({ type: "function", function: { name: "gh_list_branches", description: "List branches of a GitHub repository.", parameters: { type: "object", properties: ghRepo, required: ghRepoReq } } });
    defs.push({ type: "function", function: { name: "gh_list_issues", description: "List issues of a GitHub repository.", parameters: { type: "object", properties: { ...ghRepo, state: { type: "string" }, per_page: { type: "integer" } }, required: ghRepoReq } } });
    defs.push({ type: "function", function: { name: "gh_list_commits", description: "List recent commits of a GitHub repository.", parameters: { type: "object", properties: { ...ghRepo, sha: { type: "string" }, per_page: { type: "integer" } }, required: ghRepoReq } } });
  }
  if (has("cloudflare")) {
    defs.push({ type: "function", function: { name: "cf_list_zones", description: "List Cloudflare zones (domains).", parameters: { type: "object", properties: { per_page: { type: "integer" } } } } });
    defs.push({ type: "function", function: { name: "cf_list_dns", description: "List DNS records for a Cloudflare zone.", parameters: { type: "object", properties: { zone_id: { type: "string" }, type: { type: "string" }, name: { type: "string" }, per_page: { type: "integer" } }, required: ["zone_id"] } } });
    defs.push({ type: "function", function: { name: "cf_list_workers", description: "List Cloudflare Workers.", parameters: { type: "object", properties: { per_page: { type: "integer" } } } } });
  }
  return defs;
}

export async function executeFinalToolCall(call, meta = {}) {
  const name = call?.function?.name;
  let args = {};
  try { args = JSON.parse(call?.function?.arguments || "{}"); } catch { return "ERROR: invalid arguments."; }
  try {
    switch (name) {
      case "delegate_async": {
        const m = await import("./orchestrator.js");
        const r = await m.startAsyncDelegation({ sessionId: meta.sessionId, employeeName: args.agent_name, instruction: args.instruction });
        return r.ok ? `Background task #${r.taskId} started with ${r.agentName}. Poll async_status.` : `ERROR: ${r.error}`;
      }
      case "async_status": {
        const m = await import("./orchestrator.js");
        const list = await m.listAsyncTasks();
        return list.length ? list.map((t) => `#${t.id} [${t.status}] ${t.agentName}: ${t.preview || "(running…)"}`).join("\n") : "(no async tasks yet)";
      }
      case "wt_create": return wt.wtCreate(args);
      case "wt_cmd": return wt.wtCmd(args);
      case "wt_diff": return wt.wtDiff(args);
      case "wt_remove": return wt.wtRemove(args);
      case "term_open": term.setToolMeta(meta); return await term.termOpen(args);
      case "term_write": term.setToolMeta(meta); return await term.termWrite(args);
      case "term_read": return term.termRead(args);
      case "term_close": return term.termClose(args);
      case "web_search": return await webSearch(args);
      case "video_gen": return await videoGen(args);
      case "osv_check": return await osvCheck(args);
      case "drive_list": return await integ.driveList(args);
      case "drive_read": return await integ.driveRead(args);
      case "drive_search": return await integ.driveSearch(args);
      case "ha_states": return await integ.haStates(args);
      case "ha_call": return await integ.haCall(args);
      case "x_search": return await integ.xSearch(args);
      case "gh_list_repos": return await integ.ghListRepos({ type: args.repo_type, sort: args.sort, per_page: args.per_page });
      case "gh_get_repo": return await integ.ghGetRepo(args);
      case "gh_list_branches": return await integ.ghListBranches(args);
      case "gh_list_issues": return await integ.ghListIssues(args);
      case "gh_list_commits": return await integ.ghListCommits(args);
      case "cf_list_zones": return await integ.cfListZones(args);
      case "cf_list_dns": return await integ.cfListDns(args);
      case "cf_list_workers": return await integ.cfListWorkers(args);
      default: return null;
    }
  } catch (e) {
    return `ERROR: ${String(e?.message || e).slice(0, 300)}`;
  }
}
