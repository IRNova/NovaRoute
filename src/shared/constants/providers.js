// Provider definitions — auth-based primary categorization
import REGISTRY from "open-sse/providers/registry/index.js";
import { RISK_NOTICE } from "@/shared/constants/providersDisplay";

const MEDIA_ENTRY_KEYS = [
  "serviceKinds", "ttsConfig", "sttConfig", "embeddingConfig",
  "imageConfig", "imageToTextConfig", "videoConfig", "musicConfig",
  "searchViaChat", "searchConfig", "fetchConfig",
  "modelsFetcher", "mediaPriority", "hiddenKinds",
];

// Build provider UI object from registry entry
function buildProviderEntry(r) {
  const mediaFields = {};
  if (r.media) Object.assign(mediaFields, r.media);
  for (const k of MEDIA_ENTRY_KEYS) {
    if (r[k] !== undefined) mediaFields[k] = r[k];
  }
  const display = { ...(r.display || {}) };
  if (display.deprecationNotice === "RISK_NOTICE") display.deprecationNotice = RISK_NOTICE;
  return {
    ...display,
    id: r.id,
    alias: r.uiAlias || r.alias,
    category: r.category,
    authCategory: r.category,
    ...(r.hidden ? { hidden: true } : {}),
    ...mediaFields,
    ...(r.priority !== undefined ? { priority: r.priority } : {}),
    ...(r.hasFree ? { hasFree: true } : {}),
    ...(r.thinkingConfig ? { thinkingConfig: r.thinkingConfig } : {}),
    ...(r.regions ? { regions: r.regions, defaultRegion: r.defaultRegion } : {}),
    ...(r.hasProviderSpecificData ? { hasProviderSpecificData: true } : {}),
    ...(r.noAuth ? { noAuth: true } : {}),
    ...(r.passthroughModels ? { passthroughModels: true } : {}),
    ...(r.hasOAuth ? { hasOAuth: true } : {}),
    ...(r.authModes ? { authModes: r.authModes } : {}),
    ...(r.authType ? { authType: r.authType } : {}),
    ...(r.authHint ? { authHint: r.authHint } : {}),
    ...(r.cookieHint ? { cookieHint: r.cookieHint } : {}),
    ...(r.credentialFields ? { credentialFields: r.credentialFields } : {}),
  };
}

// ─── Auth-based primary categories ────────────────────────────────────────────
const byCategory = (cat) => Object.fromEntries(
  REGISTRY.filter(r => r.category === cat).map(r => [r.id, buildProviderEntry(r)])
);

// Core auth categories (primary grouping)
export const APIKEY_PROVIDERS = byCategory("apikey");
export const OAUTH_PROVIDERS = byCategory("oauth");
export const WEB_COOKIE_PROVIDERS = byCategory("webCookie");
export const CLI_PROVIDERS = byCategory("cli");
export const FREE_PROVIDERS = byCategory("free");
export const FREE_TIER_PROVIDERS = byCategory("freeTier");
export const NOAUTH_PROVIDERS = byCategory("noauth");
export const LOCAL_PROVIDERS = byCategory("local");

// ─── API Key sub-families (secondary grouping within API Key providers) ───────
// Provider IDs are matched by name patterns since the registry doesn't have
// explicit sub-category fields yet. These Sets drive dashboard sub-grouping.

// Frontier labs — first-party AI companies with their own models
export const FRONTIER_LAB_IDS = new Set([
  "openai", "anthropic", "gemini", "xai", "mistral", "reka", "pioneer",
  "deepseek", "zhipu", "baichuan", "minimax", "01-ai", "stepfun",
]);

// Aggregators / routers — multi-model gateways
export const AGGREGATOR_IDS = new Set([
  "openrouter", "unorouter", "requesty", "portkey", "litellm",
  "beryllium", "afrigus", "kilo-gateway",
]);

// Enterprise cloud — hyperscaler platforms
export const ENTERPRISE_CLOUD_IDS = new Set([
  "azure", "bedrock", "oci", "vertex", "sapaicore", "watsonx",
  "cloudflare-ai", "ibm-watsonx",
]);

// Inference hosts — serverless GPU / OSS model hosting
export const INFERENCE_HOST_IDS = new Set([
  "together", "fireworks", "cerebras", "groq", "baseten",
  "deepinfra", "lambda", "novita", "chutes", "banana",
  "poolside", "segmind", "blackbox",
]);

// Regional — China/regional providers
export const REGIONAL_IDS = new Set([
  "baidu", "alibaba", "tencent", "huawei", "sensetime",
  "moonshot", "minimax-cn", "baidu-2", "byteplus",
  "iflow", "oppo", "sogou", "xunfei",
]);

// Specialty media — image/video/audio/embedding focused
export const SPECIALTY_MEDIA_IDS = new Set([
  "runwayml", "kie", "pollinations", "haiper", "leonardo",
  "ideogram", "freepik", "suno", "stability", "midjourney",
  "luma", "kling", "pika", "elevenlabs", "deepl", "nlpcloud",
  "voyage", "cohere", "jina",
]);

// ─── Thinking config definitions ──────────────────────────────────────────────
export const THINKING_CONFIG = {
  extended: {
    options: ["auto", "on", "off"],
    defaultMode: "auto",
    defaultBudgetTokens: 10000
  },
  effort: {
    options: ["auto", "none", "low", "medium", "high"],
    defaultMode: "auto"
  }
};

// ─── CLI provider detection (registry-driven) ─────────────────────────────────
// Providers with category "cli" in the registry are CLI tools.
// The old hardcoded CLI_PROVIDER_IDS set is removed — the registry is source of truth.
export const CLI_PROVIDER_IDS = new Set(
  REGISTRY.filter(r => r.category === "cli").map(r => r.id)
);

// ─── Media provider kinds ─────────────────────────────────────────────────────
export const MEDIA_PROVIDER_KINDS = [
  { id: "embedding",   label: "Embedding",      icon: "data_array",        endpoint: { method: "POST", path: "/v1/embeddings" } },
  { id: "image",       label: "Text to Image",  icon: "brush",             endpoint: { method: "POST", path: "/v1/images/generations" } },
  { id: "imageToText", label: "Image to Text",  icon: "image_search",      endpoint: { method: "POST", path: "/v1/images/understanding" } },
  { id: "tts",         label: "Text To Speech", icon: "record_voice_over", endpoint: { method: "POST", path: "/v1/audio/speech" } },
  { id: "stt",         label: "Speech To Text", icon: "mic",               endpoint: { method: "POST", path: "/v1/audio/transcriptions" } },
  { id: "webSearch",   label: "Web Search",     icon: "travel_explore",    endpoint: { method: "POST", path: "/v1/search" } },
  { id: "webFetch",    label: "Web Fetch",      icon: "language",          endpoint: { method: "POST", path: "/v1/web/fetch" } },
  { id: "video",       label: "Video",          icon: "movie",             endpoint: { method: "POST", path: "/v1/videos/generations" } },
  { id: "music",       label: "Music",          icon: "music_note",        endpoint: { method: "POST", path: "/v1/audio/music" } },
];

// ─── Compatible provider prefixes ─────────────────────────────────────────────
export const OPENAI_COMPATIBLE_PREFIX = "openai-compatible-";
export const ANTHROPIC_COMPATIBLE_PREFIX = "anthropic-compatible-";
export const CUSTOM_EMBEDDING_PREFIX = "custom-embedding-";

export function isOpenAICompatibleProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(OPENAI_COMPATIBLE_PREFIX);
}

export function isAnthropicCompatibleProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(ANTHROPIC_COMPATIBLE_PREFIX);
}

export function isCustomEmbeddingProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(CUSTOM_EMBEDDING_PREFIX);
}

// ─── Auth category helpers ────────────────────────────────────────────────────
export function isCliProvider(providerId) {
  return typeof providerId === "string" && CLI_PROVIDER_IDS.has(providerId);
}

export function isCookieProvider(providerId) {
  return typeof providerId === "string" && !!WEB_COOKIE_PROVIDERS[providerId];
}

export function isOAuthProvider(providerId) {
  return typeof providerId === "string" && !!OAUTH_PROVIDERS[providerId];
}

export function isFreeProvider(providerId) {
  return typeof providerId === "string" && (!!FREE_PROVIDERS[providerId] || !!FREE_TIER_PROVIDERS[providerId]);
}

export function isLocalProvider(providerId) {
  return typeof providerId === "string" && !!LOCAL_PROVIDERS[providerId];
}

// Resolve the display auth type for a provider (used by UI badges).
// NOTE: the legacy "free" bucket is retired — every provider surfaces under
// one of apikey / oauth / cookie / cli / local. Local is checked BEFORE any
// noAuth flag so keyless local runtimes stay in the Local group.
// Truthful auth-mode resolution: returns ALL modes the provider genuinely
// supports (registry authModes is the source of truth when present).
export function resolveAuthModes(providerId, providerEntry) {
  const info = providerEntry || AI_PROVIDERS[providerId] || {};
  const modes = [];
  const push = (m) => { if (!modes.includes(m)) modes.push(m); };

  // Registry-declared modes win — they mirror what the connect flow actually offers.
  if (Array.isArray(info.authModes) && info.authModes.length > 0) {
    for (const m of info.authModes) push(m);
  }
  if (info.authType === "cookie" || info.category === "webCookie" || WEB_COOKIE_PROVIDERS[providerId]) push("cookie");
  if (CLI_PROVIDER_IDS.has(providerId) || info.category === "cli") push("cli");
  if (info.hasOAuth || info.category === "oauth" || OAUTH_PROVIDERS[providerId]) push("oauth");
  if (info.authType === "apikey" || info.category === "apikey") push("apikey");
  if (info.category === "local" || LOCAL_PROVIDERS[providerId]) push("local");

  if (modes.length === 0 && (isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId))) push("compatible");
  if (modes.length === 0) push("apikey");
  return modes;
}

const MODE_PRIORITY = ["cookie", "cli", "local", "oauth", "compatible", "apikey"];

export function resolveDisplayAuthType(providerId, providerEntry) {
  const modes = resolveAuthModes(providerId, providerEntry);
  for (const m of MODE_PRIORITY) if (modes.includes(m)) return m;
  return modes[0] || "apikey";
}

// ─── All providers (combined) ─────────────────────────────────────────────────
export const AI_PROVIDERS = {
  ...NOAUTH_PROVIDERS,
  ...FREE_PROVIDERS,
  ...FREE_TIER_PROVIDERS,
  ...LOCAL_PROVIDERS,
  ...OAUTH_PROVIDERS,
  ...WEB_COOKIE_PROVIDERS,
  ...CLI_PROVIDERS,
  ...APIKEY_PROVIDERS,
};

// ─── Auth methods (for UI filter buttons) ─────────────────────────────────────
export const AUTH_METHODS = {
  apikey: { id: "apikey", label: "API Key", icon: "key" },
  oauth: { id: "oauth", label: "Account Login", icon: "login" },
  cookie: { id: "cookie", label: "Cookie", icon: "cookie" },
  cli: { id: "cli", label: "CLI", icon: "terminal" },
  local: { id: "local", label: "Local", icon: "computer" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Get provider by alias
export function getProviderByAlias(alias) {
  for (const provider of Object.values(AI_PROVIDERS)) {
    if (provider.alias === alias || provider.id === alias) {
      return provider;
    }
  }
  return null;
}

// Get provider ID from alias
export function resolveProviderId(aliasOrId) {
  const provider = getProviderByAlias(aliasOrId);
  return provider?.id || aliasOrId;
}

// Get alias from provider ID
export function getProviderAlias(providerId) {
  const provider = AI_PROVIDERS[providerId];
  return provider?.alias || providerId;
}

// Alias to ID mapping (for quick lookup)
export const ALIAS_TO_ID = Object.values(AI_PROVIDERS).reduce((acc, p) => {
  acc[p.alias] = p.id;
  return acc;
}, {});

// ID to Alias mapping
export const ID_TO_ALIAS = Object.values(AI_PROVIDERS).reduce((acc, p) => {
  acc[p.id] = p.alias;
  return acc;
}, {});

// Get providers by service kind (e.g. "tts", "embedding", "image")
// Providers without serviceKinds default to ["llm"]
export function getProvidersByKind(kind) {
  return Object.values(AI_PROVIDERS)
    .filter((p) => {
      const kinds = p.serviceKinds ?? ["llm"];
      if (!kinds.includes(kind)) return false;
      if (p.hidden) return false;
      if (p.hiddenKinds?.includes(kind)) return false;
      return true;
    })
    .sort((a, b) => (a.priority ?? a.mediaPriority ?? 999) - (b.priority ?? b.mediaPriority ?? 999));
}

// Get providers by auth category
export function getProvidersByAuthCategory(authCat) {
  return Object.values(AI_PROVIDERS).filter(p => resolveDisplayAuthType(p.id, p) === authCat);
}

// Get API key sub-family for a provider
export function getApiKeySubFamily(providerId) {
  if (FRONTIER_LAB_IDS.has(providerId)) return "frontier";
  if (AGGREGATOR_IDS.has(providerId)) return "aggregator";
  if (ENTERPRISE_CLOUD_IDS.has(providerId)) return "enterprise";
  if (INFERENCE_HOST_IDS.has(providerId)) return "inference";
  if (REGIONAL_IDS.has(providerId)) return "regional";
  if (SPECIALTY_MEDIA_IDS.has(providerId)) return "specialty";
  return null;
}

// Derive from registry features flags
export const USAGE_SUPPORTED_PROVIDERS = REGISTRY
  .filter(r => r.features?.usage)
  .map(r => r.id);

export const USAGE_APIKEY_PROVIDERS = REGISTRY
  .filter(r => r.features?.usageApikey)
  .map(r => r.id);
