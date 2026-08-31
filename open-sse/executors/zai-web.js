// Z.ai Web executor - speaks the CURRENT private web protocol:
//   POST /api/v2/chat/completions?<fingerprint>&signature_timestamp=<ts>
//   Headers: X-FE-Version (live-resolved), X-Signature (HMAC chain)
//
// KNOWN UPSTREAM LIMITATION (honest): Z.ai currently demands its Aliyun slide
// captcha (enable_captcha=true) on chat completions for server-side clients.
// When that happens we surface a CLEAR error instead of pretending.
// Token validity + live model extraction (/api/models) work fine without it.

import crypto from "crypto";
import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { SSE_HEADERS_NO_BUFFER } from "../utils/sseConstants.js";

const SIGN_SECRET = "key-@@@@)))()((9))-xxxx&&&%%%%%";
const FALLBACK_FE = "prod-fe-1.1.88";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

// -- X-FE-Version resolver (bundle version changes with every Z.ai deploy)
const feCache = globalThis.__zaiFe ??= { value: null, at: 0 };
export async function fetchZaiFeVersion() {
  if (feCache.value && Date.now() - feCache.at < 30 * 60 * 1000) return feCache.value;
  try {
    const res = await fetch("https://chat.z.ai/", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    const html = res.ok ? await res.text() : "";
    const m = html.match(/prod-fe-(\d+\.\d+\.\d+)/);
    if (m) {
      feCache.value = `prod-fe-${m[1]}`;
      feCache.at = Date.now();
      return feCache.value;
    }
  } catch { /* fall through */ }
  feCache.at = Date.now();
  return (feCache.value ||= FALLBACK_FE);
}

function hmacHex(key, msg) {
  return crypto.createHmac("sha256", key).update(msg, "utf8").digest("hex");
}

function buildSignature(fingerprintSorted, prompt, ts) {
  const b64 = Buffer.from(prompt, "utf8").toString("base64");
  const window5m = Math.floor(Number(ts) / 300000);
  const interKey = hmacHex(SIGN_SECRET, String(window5m));
  return hmacHex(interKey, `${fingerprintSorted}|${b64}|${ts}`);
}

function buildFingerprint(token) {
  const ts = String(Date.now());
  const fp = {
    timestamp: ts,
    requestId: crypto.randomUUID(),
    user_id: "",
    version: "0.6.2",
    platform: "web",
    token,
    user_agent: UA,
    language: "en-US",
    languages: "en-US,en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    cookie_enabled: "true",
    screen_width: "1920", screen_height: "1080", screen_resolution: "1920x1080",
    viewport_height: "950", viewport_width: "1920", viewport_size: "1920x950",
    color_depth: "24", pixel_ratio: "1",
    current_url: "https://chat.z.ai/", pathname: "/", search: "", hash: "",
    host: "chat.z.ai", hostname: "chat.z.ai", protocol: "https:",
    referrer: "", title: "Z.ai",
    timezone_offset: String(new Date().getTimezoneOffset()),
    local_time: new Date().toString(), utc_time: new Date().toUTCString(),
    is_mobile: "false", is_touch: "false", max_touch_points: "10",
    browser_name: "Chrome", os_name: "Windows",
  };
  const urlParams = new URLSearchParams(fp).toString();
  const sortedPayload = Object.entries(fp)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .join(",");
  return { ts, urlParams, sortedPayload };
}

// Extract assistant text from any known success shape, defensively.
function pickContent(parsed) {
  return (
    parsed?.choices?.[0]?.message?.content ??
    parsed?.data?.data?.content ??
    parsed?.data?.content ??
    parsed?.content ??
    null
  );
}

export class ZaiWebExecutor extends BaseExecutor {
  constructor() {
    super("zai-web", PROVIDERS["zai-web"]);
  }

  async execute({ model, body, stream, credentials, signal, log }) {
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const prompt =
      typeof lastUser?.content === "string"
        ? lastUser.content.slice(0, 4000)
        : Array.isArray(lastUser?.content)
          ? lastUser.content.filter((c) => c.type === "text").map((c) => c.text).join(" ").slice(0, 4000)
          : "hi";

    const token = credentials.apiKey || credentials.accessToken || "";
    const feVersion = await fetchZaiFeVersion();
    const { ts, urlParams, sortedPayload } = buildFingerprint(token);
    const signature = buildSignature(sortedPayload, prompt, ts);

    const targetModel = model || "glm-5.3";
    const payload = {
      stream: false,
      model: targetModel,
      messages,
      signature_prompt: prompt,
      params: {},
    };

    const url = `${this.config.baseUrl}?${urlParams}&signature_timestamp=${ts}`;
    const doFetch = () =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "X-FE-Version": feVersion,
          "X-Signature": signature,
          "User-Agent": UA,
          Origin: "https://chat.z.ai",
          Referer: "https://chat.z.ai/",
        },
        body: JSON.stringify(payload),
        signal,
      });

    log?.info?.("ZAI-WEB", `chat model=${targetModel} fe=${feVersion}`);
    let response = await doFetch();

    // FE version rotated under us - refresh once and retry.
    if (response.status === 426 || /outdated/i.test(await response.clone().text().then((t) => t.slice(0, 300)).catch(() => ""))) {
      feCache.value = null;
      const fresh = await fetchZaiFeVersion();
      log?.info?.("ZAI-WEB", `FE refreshed -> ${fresh}; retrying`);
      response = await doFetch();
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const errResp = new Response(JSON.stringify({
        error: { message: `Z.ai HTTP ${response.status}: ${errText.slice(0, 200)}`, type: "upstream_error" },
      }), { status: response.status, headers: { "Content-Type": "application/json" } });
      return { response: errResp, url, headers: {}, transformedBody: payload };
    }

    // Upstream answers SSE-style ("data: {...}\n\n data: [DONE]") even for stream:false.
    const raw = await response.text();
    let parsed = null;
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payloadStr = t.slice(5).trim();
      if (!payloadStr || payloadStr === "[DONE]") continue;
      try { parsed = JSON.parse(payloadStr); } catch { /* keep last */ }
    }
    parsed = parsed?.data ?? parsed;

    const errObj = parsed?.error;
    if (errObj?.code === "FRONTEND_CAPTCHA_REQUIRED" || errObj?.error_code === "FRONTEND_CAPTCHA_REQUIRED") {
      const msg =
        "Z.ai ---- --- ------- ----- ------- (Aliyun) ----- ---- - ----- ------ -------. " +
        "---- - ---- ------ ------- --- ---- -- -- ---- ------ ----- ---.";
      const errResp = new Response(JSON.stringify({
        error: { message: msg, type: "upstream_captcha", code: "ZAI_CAPTCHA_REQUIRED" },
      }), { status: 403, headers: { "Content-Type": "application/json" } });
      return { response: errResp, url, headers: {}, transformedBody: payload };
    }
    if (parsed?.done === true && errObj) {
      const errResp = new Response(JSON.stringify({
        error: { message: `Z.ai error: ${errObj.detail || errObj.code || "unknown"}`, type: "upstream_error" },
      }), { status: 502, headers: { "Content-Type": "application/json" } });
      return { response: errResp, url, headers: {}, transformedBody: payload };
    }

    const content = pickContent(parsed);
    if (!content) {
      // Unknown success shape - pass the REAL raw payload through, never fabricate.
      const errResp = new Response(JSON.stringify({
        error: { message: "Unrecognized Z.ai response shape", raw: raw.slice(0, 1200), type: "upstream_shape" },
      }), { status: 502, headers: { "Content-Type": "application/json" } });
      return { response: errResp, url, headers: {}, transformedBody: payload };
    }

    const cid = `chatcmpl-zai-${crypto.randomUUID().slice(0, 12)}`;
    const created = Math.floor(Date.now() / 1000);
    const json = {
      id: cid,
      object: "chat.completion",
      created,
      model: targetModel,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop", logprobs: null }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    if (!stream) {
      return { response: new Response(JSON.stringify(json), { headers: { "Content-Type": "application/json" } }), url, headers: {}, transformedBody: payload };
    }
    // Minimal SSE emission from the completed answer.
    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: cid, object: "chat.completion.chunk", created, model: targetModel, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id: cid, object: "chat.completion.chunk", created, model: targetModel, choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return { response: new Response(sse, { headers: { ...SSE_HEADERS_NO_BUFFER } }), url, headers: {}, transformedBody: payload };
  }
}

// Live model extraction for the dashboard (works WITHOUT captcha).
export async function fetchZaiLiveModels(token) {
  const feVersion = await fetchZaiFeVersion();
  const res = await fetch("https://chat.z.ai/api/models", {
    headers: { Authorization: `Bearer ${token}`, "X-FE-Version": feVersion, "User-Agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  return list.map((m) => ({ id: m.id, name: m.name || m.id }));
}
