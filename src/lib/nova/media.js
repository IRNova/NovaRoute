// Nova Bot — media agent tools (vision, image_gen, tts, transcribe).
// These call the LOCAL NovaRoute gateway (/v1/*) so all provider translation,
// credentials and fallbacks are reused. Default models come from kv
// scope "novaMedia": { imageModel, ttsModel, sttModel, visionModel }.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getApiKeys } from "@/lib/localDb";
import { makeKv } from "@/lib/db/helpers/kvStore.js";
import { isUrlSafe } from "./sandbox.js";

const kv = makeKv("novaMedia");
const AUDIO_DIR = "/tmp/nova-audio";

let _gwBase = null;
function gatewayBase() {
  if (_gwBase) return _gwBase;
  const port = process.env.PORT || 20128;
  _gwBase = `http://127.0.0.1:${port}`;
  return _gwBase;
}

async function internalKey() {
  try {
    const keys = await getApiKeys();
    const active = (Array.isArray(keys) ? keys : []).find((k) => k.enabled !== false);
    return active?.key || null;
  } catch {
    return null;
  }
}

async function gwJson(route, body, timeoutMs = 120_000) {
  const key = await internalKey();
  if (!key) throw new Error("no API key configured on the gateway — create one in the dashboard first");
  const res = await fetch(gatewayBase() + route, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.statusCode}`);
  return json;
}

async function getModelDefault(field) {
  const cfg = (await kv.get("defaults", {})) || {};
  return cfg[field] || "";
}

export async function setModelDefaults(patch) {
  const cfg = { ...((await kv.get("defaults", {})) || {}), ...patch };
  await kv.set("defaults", cfg);
  return cfg;
}

/* ── Vision: ask about an image via a multimodal chat model ────────── */

export async function vision({ image_url, image_path, prompt, model }) {
  let url = image_url ? String(image_url) : null;
  if (!url && image_path) {
    const buf = await readFile(String(image_path));
    const ext = path.extname(String(image_path)).slice(1) || "png";
    url = `data:image/${ext};base64,${buf.toString("base64")}`;
  }
  if (!url) throw new Error("image_url or image_path required");
  if (/^https?:/i.test(url) && !isUrlSafe(url)) throw new Error("blocked image URL (private network)");

  const useModel = model || (await getModelDefault("visionModel"));
  if (!useModel) throw new Error('no vision model set — admin must configure novaMedia defaults (e.g. "gemini/gemini-2.5-flash")');

  const json = await gwJson("/v1/chat/completions", {
    model: useModel,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: String(prompt || "Describe this image in detail.") },
        { type: "image_url", image_url: { url } },
      ],
    }],
    max_tokens: 1500,
  });
  return json?.choices?.[0]?.message?.content || "(empty vision response)";
}

/* ── Image generation ──────────────────────────────────────────────── */

export async function imageGen({ prompt, size, model }) {
  const useModel = model || (await getModelDefault("imageModel"));
  if (!useModel) throw new Error('no image model set — configure novaMedia defaults (e.g. "openai/dall-e-3")');
  const json = await gwJson("/v1/images/generations", {
    model: useModel,
    prompt: String(prompt || "").slice(0, 4000),
    n: 1,
    ...(size ? { size } : {}),
  });
  const item = json?.data?.[0];
  if (item?.b64_json) {
    const file = `${AUDIO_DIR}/img-${Date.now()}.png`.replace("/nova-audio", "");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(path.dirname(file), { recursive: true }).catch(() => {});
    await writeFile(file, Buffer.from(item.b64_json, "base64")).catch(() => {});
    return `Image saved: ${file}`;
  }
  return item?.url ? `Image URL: ${item.url}` : "(no image returned)";
}

/* ── TTS: text → audio file ────────────────────────────────────────── */

export async function tts({ text, model, voice }) {
  const useModel = model || (await getModelDefault("ttsModel"));
  if (!useModel) throw new Error('no TTS model set — configure novaMedia defaults (e.g. "openai/tts-1")');
  const key = await internalKey();
  const res = await fetch(gatewayBase() + "/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: useModel,
      input: String(text || "").slice(0, 4000),
      voice: voice || (await getModelDefault("voice")) || "alloy",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`TTS HTTP ${res.statusCode}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await import("node:fs/promises").then((fs) => fs.mkdir(AUDIO_DIR, { recursive: true }).catch(() => {}));
  const file = path.join(AUDIO_DIR, `speech-${Date.now()}.mp3`);
  await import("node:fs/promises").then((fs) => fs.writeFile(file, buf));
  return `Audio saved (${Math.round(buf.length / 1024)}KB): ${file}`;
}

/* ── STT/transcription: audio file → text ──────────────────────────── */

export async function transcribe({ audio_path, language }) {
  const useModel = (await getModelDefault("sttModel")) || "openai/whisper-1";
  const key = await internalKey();
  const buf = await readFile(String(audio_path));
  const fd = new FormData();
  fd.append("file", new Blob([buf]), path.basename(String(audio_path)));
  fd.append("model", useModel);
  if (language) fd.append("language", String(language));
  const res = await fetch(gatewayBase() + "/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: fd,
    signal: AbortSignal.timeout(180_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `STT HTTP ${res.statusCode}`);
  return json?.text || "(empty transcription)";
}
