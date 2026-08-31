// WhatsApp Cloud API webhook (Meta) — GET verify + POST inbound messages.
// Config: kv scope "channels" key "whatsapp-cloud" →
//   { enabled, phoneNumberId, accessToken, verifyToken }
import { NextResponse } from "next/server";
import { makeKv } from "@/lib/db/helpers/kvStore.js";
import {
  getNovaSessionById,
  getNovaSessions,
  createNovaSession,
  getNovaMessages,
} from "@/lib/db/repos/novaRepo.js";
import { runNovaTurn } from "@/lib/nova/orchestrator.js";

const kv = makeKv("channels");
const WA_SESSION_PREFIX = "[whatsapp] ";

export const dynamic = "force-dynamic";

async function waConfig() {
  const cfg = (await kv.get("whatsapp-cloud", null)) || null;
  return cfg?.enabled && cfg.accessToken && cfg.phoneNumberId ? cfg : null;
}

function extractText(payload) {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  if (change?.field !== "messages") return null;
  const value = change.value || {};
  const msg = value.messages?.[0];
  if (!msg) return null; // status updates etc.
  const from = String(msg.from || "");
  let text = "";
  let mediaId = null;
  let mediaMime = null;
  if (msg.type === "text") text = String(msg.text?.body || "");
  else if (msg.type === "audio" || msg.type === "voice") {
    mediaId = msg.audio?.id || msg.voice?.id;
    mediaMime = msg.audio?.mime_type || msg.voice?.mime_type;
  } else if (msg.type === "button") text = String(msg.button?.text || "");
  else if (msg.type === "interactive") text = String(msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "");
  return { from, text, mediaId, mediaMime };
}

export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const cfg = await waConfig();
  if (mode === "subscribe" && cfg && token === cfg.verifyToken) {
    return new Response(challenge || "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

async function sendWa(cfg, to, body) {
  await fetch(`https://graph.facebook.com/v20.0/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: String(body).slice(0, 4000) } }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => {});
}

async function downloadWaMedia(cfg, mediaId) {
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { authorization: `Bearer ${cfg.accessToken}` },
  });
  const meta = await metaRes.json().catch(() => null);
  if (!meta?.url) throw new Error("media metadata failed");
  const bin = await fetch(meta.url, { headers: { authorization: `Bearer ${cfg.accessToken}` } });
  const buf = Buffer.from(await bin.arrayBuffer());
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir("/tmp/nova-wa", { recursive: true }).catch(() => {});
  const ext = (String(meta.mime_type || "").split("/")[1] || "ogg").split(";")[0];
  const path = `/tmp/nova-wa/${mediaId}.${ext}`;
  await writeFile(path, buf);
  return path;
}

async function handleInbound(item) {
  const cfg = await waConfig();
  if (!cfg) return;

  let prompt = item.text;
  if (!prompt && item.mediaId && /audio|ogg|mp3|mpeg/i.test(String(item.mediaMime))) {
    try {
      const { transcribe } = await import("@/lib/nova/media.js");
      const audioPath = await downloadWaMedia(cfg, item.mediaId);
      prompt = String(await transcribe({ audio_path: audioPath }) || "").trim();
    } catch { prompt = ""; }
  }
  if (!prompt) return;

  const title = WA_SESSION_PREFIX + item.from;
  const sessions = await getNovaSessions();
  const existing = sessions.find((s) => s.title === title);
  const sessionId = existing ? existing.id : (await createNovaSession(title))?.id;
  if (!sessionId) return;

  try {
    await runNovaTurn({ sessionId, text: prompt, onEvent: () => {} });
    const msgs = await getNovaMessages(sessionId);
    const lastAgent = [...msgs].reverse().find((m) => m.role === "agent" && m.agentRole === "ceo");
    const answer = String(lastAgent?.content || "").trim() || "…";
    await sendWa(cfg, item.from, answer);
  } catch (e) {
    await sendWa(cfg, item.from, `⚠️ ${String(e?.message || e).slice(0, 180)}`);
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const item = extractText(payload);
    if (item) setImmediate(() => handleInbound(item).catch(() => {}));
  } catch { /* never throw into Meta */ }
  return NextResponse.json({ ok: true });
}
