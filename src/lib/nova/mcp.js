// Nova Bot — minimal MCP (Model Context Protocol) client.
// Supports stdio servers (spawned processes, line-delimited JSON-RPC) and
// HTTP servers (single-shot JSON-RPC POST). Server configs live in kv
// scope "novaMcp": { servers: [{ name, transport, command, args, env, url }] }.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("novaMcp");

const sessions = new Map(); // serverName -> { child, pending: Map<id, resolve>, buffer }
const SESSION_IDLE_MS = 5 * 60_000;

/** Return a valid access token for an OAuth-configured server (auto-refresh). */
async function getValidAccessToken(server) {
  const oa = server?.oauth;
  if (!oa?.tokens?.access_token) return null;
  const t = oa.tokens;
  if (t.expires_at && Date.now() < t.expires_at - 60_000) return t.access_token;

  // expired → refresh
  if (!t.refresh_token || !oa.tokenUrl) return t.access_token; // best effort
  try {
    const res = await fetch(oa.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: t.refresh_token,
        client_id: oa.clientId || "",
        ...(oa.clientSecret ? { client_secret: oa.clientSecret } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.access_token) {
      const servers = await getConfig2();
      const i = servers.findIndex((x) => x.name === server.name);
      if (i !== -1) {
        servers[i].oauth = {
          ...oa,
          tokens: {
            access_token: json.access_token,
            refresh_token: json.refresh_token || t.refresh_token,
            expires_at: Date.now() + (Number(json.expires_in) || 3600) * 1000,
            token_type: json.token_type || "Bearer",
          },
        };
        await kv.set("servers", servers);
      }
      return json.access_token;
    }
  } catch { /* fall through */ }
  return t.access_token;
}

async function getConfig2() {
  return (await kv.get("servers", [])) || [];
}

async function getConfig() {
  return (await kv.get("servers", [])) || [];
}

export async function saveServers(servers) {
  await kv.set("servers", Array.isArray(servers) ? servers.slice(0, 20) : []);
}

/* ── stdio session handling ────────────────────────────────────────── */

function frame(msg) {
  // LSP-style Content-Length framing is common; many MCP stdio servers also
  // accept newline-delimited. We use newline-delimited (MCP default).
  return JSON.stringify(msg) + "\n";
}

function ensureSession(server) {
  if (server.transport !== "stdio") throw new Error("not a stdio server");
  let sess = sessions.get(server.name);
  if (sess && sess.child.exitCode === null) return sess;

  const child = spawn(server.command, server.args || [], {
    env: { ...process.env, ...(server.env || {}) },
    stdio: ["pipe", "pipe", "pipe"],
  });
  sess = { child, pending: new Map(), buffer: "" };
  sessions.set(server.name, sess);

  child.stdout.on("data", (chunk) => {
    sess.buffer += chunk.toString("utf8");
    let idx;
    while ((idx = sess.buffer.indexOf("\n")) !== -1) {
      const line = sess.buffer.slice(0, idx).trim();
      sess.buffer = sess.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && sess.pending.has(msg.id)) {
          sess.pending.get(msg.id)(msg);
          sess.pending.delete(msg.id);
        }
      } catch { /* non-JSON line — ignore */ }
    }
  });
  child.on("exit", () => sessions.delete(server.name));
  setTimeout(() => { try { child.kill(); } catch {} }, SESSION_IDLE_MS).unref?.();

  return sess;
}

function rpc(sess, method, params, timeoutMs = 15_000) {
  const id = Math.floor(randomUUID().slice(0, 8).replace(/\D/g, "") || "1");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sess.pending.delete(id);
      reject(new Error(`MCP timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    sess.pending.set(id, (msg) => {
      clearTimeout(timer);
      if (msg.error) reject(new Error(String(msg.error.message || JSON.stringify(msg.error)).slice(0, 300)));
      else resolve(msg.result);
    });
    sess.child.stdin.write(frame({ jsonrpc: "2.0", id, method, params }));
  });
}

async function httpRpc(server, method, params) {
  const oauthTok = await getValidAccessToken(server);
  const bearerFromOauth = oauthTok ? `Bearer ${oauthTok}` : null;
  const res = await fetch(server.url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearerFromOauth ? { authorization: bearerFromOauth } : {}), ...(server.headers || {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`HTTP ${res.statusCode} bad JSON`);
  if (json.error) throw new Error(String(json.error.message || "").slice(0, 300));
  return json.result;
}

/* ── Public API ────────────────────────────────────────────────────── */

export async function listServerTools(serverName) {
  const servers = await getConfig();
  const server = servers.find((s) => s.name === serverName);
  if (!server) throw new Error(`MCP server "${serverName}" not configured`);

  let result;
  if (server.transport === "http") {
    result = await httpRpc(server, "tools/list", {});
  } else {
    const sess = ensureSession(server);
    await rpc(sess, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "NovaBot", version: "1.0" },
    }).catch(() => {}); // some servers require it; tolerate absence
    result = await rpc(sess, "tools/list", {});
  }

  const tools = (result?.tools || []).map((t) => ({
    name: t.name,
    description: String(t.description || "").slice(0, 200),
    schema: t.inputSchema || {},
  }));
  return tools;
}

export async function callServerTool(serverName, toolName, args) {
  const servers = await getConfig();
  const server = servers.find((s) => s.name === serverName);
  if (!server) throw new Error(`MCP server "${serverName}" not configured`);

  const params = { name: toolName, arguments: args || {} };
  const result = server.transport === "http"
    ? await httpRpc(server, "tools/call", params)
    : await rpc(ensureSession(server), "tools/call", params, 60_000);

  // Normalize content array → text.
  const content = result?.content;
  if (Array.isArray(content)) {
    return content.map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n").slice(0, 8_000) || "(empty)";
  }
  return JSON.stringify(result ?? {}, null, 1).slice(0, 8_000);
}
