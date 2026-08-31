import { PROVIDERS } from "open-sse/config/providers.js";
import { getProviderModels, PROVIDER_ID_TO_ALIAS } from "open-sse/config/providerModels.js";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { CLAUDE_CLI_SPOOF_HEADERS, ANTHROPIC_API_VERSION } from "open-sse/providers/shared.js";

// Providers with a known GET /models endpoint (Bearer auth unless noted).
const MODELS_ENDPOINTS = {
  openai: "https://api.openai.com/v1/models",
  openrouter: "https://openrouter.ai/api/v1/models",
  anthropic: "https://api.anthropic.com/v1/models",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  deepseek: "https://api.deepseek.com/models",
  groq: "https://api.groq.com/openai/v1/models",
  xai: "https://api.x.ai/v1/models",
  mistral: "https://api.mistral.ai/v1/models",
  perplexity: "https://api.perplexity.ai/v1/models",
  "perplexity-agent": "https://api.perplexity.ai/v1/models",
  together: "https://api.together.xyz/v1/models",
  fireworks: "https://api.fireworks.ai/inference/v1/models",
  cerebras: "https://api.cerebras.ai/v1/models",
  cohere: "https://api.cohere.ai/v1/models",
  nebius: "https://api.studio.nebius.ai/v1/models",
  siliconflow: "https://api.siliconflow.com/v1/models",
  hyperbolic: "https://api.hyperbolic.xyz/v1/models",
  nvidia: "https://integrate.api.nvidia.com/v1/models",
  alicode: "https://coding.dashscope.aliyuncs.com/v1/models",
  "alicode-intl": "https://coding-intl.dashscope.aliyuncs.com/v1/models",
  "alims-intl": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
  "volcengine-ark": "https://ark.cn-beijing.volces.com/api/coding/v3/models",
  byteplus: "https://ark.ap-southeast.bytepluses.com/api/coding/v3/models",
  nanobanana: "https://api.nanobananaapi.ai/v1/models",
  chutes: "https://llm.chutes.ai/v1/models",
  "vercel-ai-gateway": "https://ai-gateway.vercel.sh/v1/models",
};

function stripMessagesSuffix(url) {
  return url.replace(/\/messages$/, "").replace(/\/chat\/completions$/, "").replace(/\/$/, "");
}

// Mirror the discovery normalizer in open-sse: strip trailing /chat/completions,
// /completions, /messages and a trailing /v1 so we can re-add exactly one /v1.
function normalizeBaseUrl(rawBaseUrl) {
  let base = String(rawBaseUrl || "").trim().replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) base = base.slice(0, -17);
  else if (base.endsWith("/completions")) base = base.slice(0, -12);
  if (base.endsWith("/messages")) base = base.slice(0, -9);
  if (base.endsWith("/v1") && !base.endsWith("://v1")) base = base.slice(0, -3);
  return base;
}

function isFreeOpenRouterModel(m) {
  const p = m?.pricing || {};
  const prompt = String(p?.prompt ?? "");
  const completion = String(p?.completion ?? "");
  return prompt === "0" && completion === "0";
}

function parseModelList(data, type) {
  let list = Array.isArray(data) ? data : data?.data || data?.models || data?.results || data?.model || [];
  if (!Array.isArray(list)) list = [];
  if (type === "openrouter-free") {
    list = list.filter(isFreeOpenRouterModel);
  }
  return list
    .map((m) => ({
      id: m?.id || m?.model || m?.name,
      name: m?.name || m?.display_name || m?.displayName || m?.id || "",
    }))
    .filter((m) => m.id);
}

async function tryModelsEndpoint(url, headers, type) {
  try {
    const res = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return parseModelList(data, type);
  } catch {
    return null;
  }
}

/**
 * Fetch a provider's live model list. If an API key is provided it is used for
 * authenticated endpoints; otherwise public/no-auth endpoints are tried first.
 * Falls back to the static catalog when no live endpoint is reachable.
 * Returns { models, static, warning }.
 */
export async function fetchProviderModels({ provider, apiKey, providerSpecificData = {} }) {
  const alias = PROVIDER_ID_TO_ALIAS[provider] || provider;
  const fallback = () => getProviderModels(alias).map((m) => ({ id: m.id, name: m.name || m.id }));
  const staticFallback = (warning) => ({ models: fallback(), static: true, warning });

  const cfg = PROVIDERS[provider] || {};
  const psdBase = String(providerSpecificData?.baseUrl || "");
  // Compatible providers carry their baseUrl on the node; fall back to the
  // registry baseUrl (like the open-sse discovery path does).
  const baseUrl = psdBase || cfg.baseUrl || "";
  if (!baseUrl && !cfg.modelsFetcher?.url) return staticFallback("No base URL available for this provider");

  const hasKey = typeof apiKey === "string" && apiKey.length > 0;

  const bearerHeaders = hasKey
    ? { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }
    : { "Content-Type": "application/json" };
  const anthropicHeaders = hasKey
    ? {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        ...(provider === "agentrouter" ? CLAUDE_CLI_SPOOF_HEADERS : {}),
      }
    : { "Content-Type": "application/json", "anthropic-version": ANTHROPIC_API_VERSION };

  const candidates = []; // { url, headers, queryKey?, authRequired? }

  // Providers that declare a modelsFetcher get their live catalog from that URL.
  if (cfg.modelsFetcher?.url) {
    const fetcherUrl = cfg.modelsFetcher.url;
    const fetcherHeaders = hasKey
      ? { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(cfg.modelsFetcher.headers || {}) }
      : { "Content-Type": "application/json", ...(cfg.modelsFetcher.headers || {}) };
    candidates.push({ url: fetcherUrl, headers: fetcherHeaders, type: cfg.modelsFetcher.type });
  }

  if (isOpenAICompatibleProvider(provider)) {
    const base = normalizeBaseUrl(baseUrl);
    candidates.push(
      { url: `${base}/v1/models`, headers: bearerHeaders },
      { url: `${base}/models`, headers: bearerHeaders }
    );
  } else if (isAnthropicCompatibleProvider(provider)) {
    const base = normalizeBaseUrl(baseUrl);
    candidates.push(
      { url: `${base}/v1/models`, headers: anthropicHeaders },
      { url: `${base}/models`, headers: anthropicHeaders }
    );
  } else if (MODELS_ENDPOINTS[provider]) {
    const hardUrl = MODELS_ENDPOINTS[provider];
    if (provider === "gemini") {
      // Gemini /models is public but rate-limited; key improves reliability.
      candidates.push({ url: hardUrl, headers: {}, queryKey: hasKey });
    } else if (provider === "anthropic") {
      candidates.push({ url: hardUrl, headers: anthropicHeaders });
    } else {
      candidates.push({ url: hardUrl, headers: bearerHeaders });
    }
    // Also try the registry-derived URL in case the hardcoded one is stale.
    const base = normalizeBaseUrl(baseUrl);
    if (base && !hardUrl.startsWith(base)) {
      candidates.push(
        { url: `${base}/v1/models`, headers: bearerHeaders },
        { url: `${base}/models`, headers: bearerHeaders }
      );
    }
  } else if (cfg.format === "claude") {
    const base = normalizeBaseUrl(baseUrl);
    candidates.push(
      { url: `${base}/v1/models`, headers: anthropicHeaders },
      { url: `${base}/models`, headers: anthropicHeaders }
    );
  } else if (cfg.format === "ollama") {
    const base = normalizeBaseUrl(baseUrl).replace(/\/chat$/, "");
    candidates.push({ url: `${base}/api/tags`, headers: {} });
  } else {
    const base = normalizeBaseUrl(baseUrl);
    candidates.push(
      { url: `${base}/v1/models`, headers: bearerHeaders },
      { url: `${base}/models`, headers: bearerHeaders }
    );
  }

  // Try all candidates in parallel — first to return results wins.
  const attempts = candidates.map(({ url, headers, queryKey, type }) => {
    const fullUrl = queryKey ? `${url}?key=${encodeURIComponent(apiKey || "")}` : url;
    return tryModelsEndpoint(fullUrl, headers, type).then((models) => {
      if (queryKey && models) {
        return models.map((m) => ({ id: m.id.replace(/^models\//, ""), name: m.name || m.id }));
      }
      return models;
    });
  });

  const results = await Promise.allSettled(attempts);
  for (const r of results) {
    if (r.status === "fulfilled" && r.value && r.value.length > 0) {
      return { models: r.value };
    }
  }

  return staticFallback("Live models endpoint unavailable — using the built-in catalog");
}

async function parseChatResponse(res, t0) {
  const latencyMs = Date.now() - t0;
  const raw = await res.text().catch(() => "");
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch {}
  if (res.ok) {
    const hasChoices = Array.isArray(parsed?.choices) && parsed.choices.length > 0;
    const hasContent = typeof parsed?.content === "string" && parsed.content.length > 0;
    const hasMessage = parsed?.message?.content;
    if (hasChoices || hasContent || hasMessage) {
      // Capture a short reply preview so deep-tests can prove a REAL completion
      // came back (not just a 200 status).
      const choiceContent = parsed?.choices?.[0]?.message?.content;
      const previewSource =
        typeof choiceContent === "string"
          ? choiceContent
          : typeof parsed?.message?.content === "string"
            ? parsed.message.content
            : parsed?.content;
      return {
        ok: true,
        latencyMs,
        status: res.status,
        error: null,
        preview: typeof previewSource === "string" ? previewSource.slice(0, 140) : null,
        model: parsed?.model || null,
      };
    }
    return { ok: false, latencyMs, status: res.status, error: "Provider returned no completion for this model" };
  }
  const detail = parsed?.error?.message || parsed?.error || parsed?.message || raw || `HTTP ${res.status}`;
  return { ok: false, latencyMs, status: res.status, error: String(detail).slice(0, 300) };
}

/**
 * Send a single minimal chat message to a provider for a given model using a raw
 * (possibly unsaved) API key. Supports openai / claude / ollama formats.
 * Returns { ok, latencyMs, status, error }.
 */
export async function pingProviderModel({ provider, apiKey, providerSpecificData = {}, model }) {
  const t0 = Date.now();
  const fail = (status, error) => ({ ok: false, latencyMs: Date.now() - t0, status, error: String(error).slice(0, 300) });
  const cfg = PROVIDERS[provider] || {};

  const chatBody = JSON.stringify({
    model,
    max_tokens: 16,
    messages: [{ role: "user", content: "hi" }],
  });

  try {
    if (isOpenAICompatibleProvider(provider)) {
      const base = normalizeBaseUrl(String(providerSpecificData?.baseUrl || ""));
      if (!base) return fail(0, "No base URL configured");
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: chatBody,
        signal: AbortSignal.timeout(15000),
      });
      return await parseChatResponse(res, t0);
    }

    if (isAnthropicCompatibleProvider(provider)) {
      let base = normalizeBaseUrl(String(providerSpecificData?.baseUrl || ""));
      if (!base) return fail(0, "No base URL configured");
      base = `${base}/v1/messages`;
      const res = await fetch(base, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
          Authorization: `Bearer ${apiKey}`,
        },
        body: chatBody,
        signal: AbortSignal.timeout(15000),
      });
      return await parseChatResponse(res, t0);
    }

    if (!cfg?.baseUrl) return fail(0, "No base URL configured for this provider");

    if (cfg.format === "claude") {
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        ...(provider === "agentrouter" ? CLAUDE_CLI_SPOOF_HEADERS : {}),
      };
      const res = await fetch(cfg.baseUrl, {
        method: "POST",
        headers,
        body: chatBody,
        signal: AbortSignal.timeout(15000),
      });
      return await parseChatResponse(res, t0);
    }

    if (cfg.format === "ollama") {
      const url = cfg.baseUrl.endsWith("/api/chat") ? cfg.baseUrl : `${cfg.baseUrl.replace(/\/$/, "")}/api/chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], stream: false }),
        signal: AbortSignal.timeout(15000),
      });
      const parsed = await res.json().catch(() => null);
      if (res.ok && (parsed?.message?.content || parsed?.choices?.length)) {
        return { ok: true, latencyMs: Date.now() - t0, status: res.status, error: null };
      }
      return fail(res.status, parsed?.error || `HTTP ${res.status}`);
    }

    // Default: OpenAI-compatible chat endpoint (registry baseUrl already points at /chat/completions)
    const res = await fetch(cfg.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: chatBody,
      signal: AbortSignal.timeout(15000),
    });
    return await parseChatResponse(res, t0);
  } catch (error) {
    return fail(0, error.message || "Request failed");
  }
}
