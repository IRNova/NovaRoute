// Nova Bot — Discord channel adapter (Hermes gateway style).
// Connects via the Discord Gateway WebSocket (global WebSocket, Node ≥22),
// answers messages through the Nova Bot orchestrator, replies over REST.
// Config: kv scope "channels" key "discord" →
//   { enabled: bool, token: string, allowDM: bool, channelIds?: [ids] }

import { makeKv } from "@/lib/db/helpers/kvStore.js";
import {
  getNovaSessionById,
  getNovaSessions,
  createNovaSession,
  createNovaMessage,
  getNovaMessages,
} from "@/lib/db/repos/novaRepo.js";
import { runNovaTurn } from "./orchestrator.js";
import { discordReact } from "./integrations.js";

const kv = makeKv("channels");
const REST = "https://discord.com/api/v10";
const DISCORD_SESSION_PREFIX = "[discord] ";

const state = { ws: null, booted: false, heartbeatTimer: null, seq: null, sessionId: null, backoffMs: 1000 };

async function getConfig() {
  const cfg = (await kv.get("discord", null)) || null;
  if (!cfg?.enabled || !cfg.token) return null;
  return cfg;
}

async function rest(method, path, body) {
  const cfg = await getConfig();
  const res = await fetch(REST + path, {
    method,
    headers: {
      authorization: `Bot ${cfg.token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok && res.status !== 204) throw new Error(`Discord ${method} ${path} → ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

function chunkMessage(text) {
  const parts = [];
  let cur = "";
  for (const para of String(text || "").split("\n")) {
    if ((cur + para).length > 1900) {
      if (cur) parts.push(cur.trimEnd());
      cur = para.slice(0, 1900) + "\n";
    } else {
      cur += para + "\n";
    }
  }
  if (cur.trim()) parts.push(cur.trimEnd());
  return parts.slice(0, 5); // cap spam
}

async function resolveDiscordSession(channelKey) {
  const title = DISCORD_SESSION_PREFIX + channelKey;
  const sessions = await getNovaSessions();
  const existing = sessions.find((s) => s.title === title);
  if (existing) return existing.id;
  const created = await createNovaSession(title);
  return created?.id || created;
}

async function handleMessage(msg) {
  const cfg = await getConfig();
  if (!cfg) return;
  if (msg.author?.bot) return;

  const isDM = !msg.guild_id;
  if (isDM && cfg.allowDM === false) return;
  const allowed = Array.isArray(cfg.channelIds) && cfg.channelIds.length > 0
    ? cfg.channelIds.map(String).includes(String(msg.channel_id))
    : true;
  if (!allowed) return;

  const text = String(msg.content || "").trim();
  if (!text) return;

  // 👀 acknowledge receipt with an emoji when configured
  try {
    const cfgR = await getConfig();
    if (cfgR?.reactEmoji) await discordReact(cfgR.token, msg.channel_id, msg.id, cfgR.reactEmoji);
  } catch {}

  await rest("POST", `/channels/${msg.channel_id}/typing`).catch(() => {});

  try {
    const sessionId = await resolveDiscordSession(String(msg.channel_id));
    await runNovaTurn({ sessionId, text, onEvent: () => {} });

    // Reply with the latest CEO answer for this session.
    const msgs = await getNovaMessages(sessionId);
    const lastAgent = [...msgs].reverse().find((m) => m.role === "agent" && m.agentRole === "ceo");
    const answer = String(lastAgent?.content || "").trim();
    if (!answer) return;
    for (const part of chunkMessage(answer)) {
      await rest("POST", `/channels/${msg.channel_id}/messages`, { content: part });
    }
  } catch (e) {
    await rest("POST", `/channels/${msg.channel_id}/messages`, {
      content: `⚠️ ${String(e?.message || e).slice(0, 180)}`,
    }).catch(() => {});
  }
}

async function connect() {
  const cfg = await getConfig();
  if (!cfg) return false;

  // Fetch a fresh gateway URL.
  const gwRes = await fetch(REST + "/gateway/bot", {
    headers: { authorization: `Bot ${cfg.token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!gwRes.ok) throw new Error(`gateway/bot HTTP ${gwRes.status}`);
  const gw = await gwRes.json();
  const url = `${gw.url}?v=10&encoding=json`;

  const ws = new WebSocket(url);
  state.ws = ws;

  ws.onopen = () => { state.backoffMs = 1000; };
  ws.onmessage = async (event) => {
    let p;
    try { p = JSON.parse(event.data); } catch { return; }
    if (p.s != null) state.seq = p.s;

    switch (p.op) {
      case 10: { // Hello
        const interval = p.d?.heartbeat_interval || 41250;
        clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = setInterval(() => {
          try { ws.send(JSON.stringify({ op: 1, d: state.seq })); } catch {}
        }, interval);
        ws.send(JSON.stringify({
          op: 2,
          d: {
            token: cfg.token,
            intents: 512 | 32768 | 128, // GUILD_MESSAGES | MESSAGE_CONTENT | DIRECT_MESSAGES
            properties: { os: "linux", browser: "novabot", device: "novabot" },
          },
        }));
        break;
      }
      case 11: break; // Heartbeat ACK
      case 0:
        if (p.t === "MESSAGE_CREATE") handleMessage(p.d).catch(() => {});
        break;
      case 7: // Reconnect requested
        try { ws.close(); } catch {}
        break;
      case 9: // Invalid session → fresh identify after brief wait
        setTimeout(() => connect().catch(() => {}), 3000);
        break;
    }
  };

  ws.onclose = () => {
    clearInterval(state.heartbeatTimer);
    state.ws = null;
    // Exponential backoff reconnect while enabled.
    setTimeout(() => {
      connect().catch(() => {});
    }, state.backoffMs);
    state.backoffMs = Math.min(state.backoffMs * 2, 60_000);
  };

  return true;
}

/** Boot once per process; safe to call repeatedly. */
export async function ensureDiscordBot() {
  if (state.booted) return isDiscordRunning();
  state.booted = true;
  try {
    return await connect();
  } catch (e) {
    console.error("[discord] boot failed:", String(e?.message || e).slice(0, 200));
    return false;
  }
}

export function isDiscordRunning() {
  return !!state.ws;
}
