// Provider icon paths under /public/providers.
// Alias related brands; session-cache 404s so one miss never spams again.

const ICON_ALIASES = {
  "perplexity-agent": "perplexity",
  "gitlab-duo": "gitlab",
  "vercel-ai-gateway": "vercel",
  "opencode-zen": "opencode",
};

// Providers that have real .png logos — everything else uses .svg placeholders.
const PNG_PROVIDER_IDS = new Set(["adapta-web","agentrouter","aimlapi","alicode","alicode-intl","amp","anthropic","anthropic-m","antigravity","api-airforce","assemblyai","aws-polly","azure","baidu","bazaarlink","blackbox","blackbox-web","black-forest-labs","bluesminds","brave-search","byteplus","cartesia","cerebras","chutes","claude","cline","clinepass","cliproxyapi","cloudflare-ai","codebuddy-cn","codebuddy-intl","codex","cohere","comfyui","commandcode","continue","copilot","coqui","cursor","dahl","deepgram","deepseek","deepseek-tui","devin-cli","droid","edge-tts","elevenlabs","empower","exa","fal-ai","featherless","firecrawl","fireworks","gemini","gemini-cli","gigachat","github","gitlab","glm","glm-cn","google-pse","google-tts","grok-cli","grok-web","groq","hermes","huggingface","hyperbolic","iflow","inner-ai","inworld","ironclaw","jcode","jina-ai","jina-reader","kie","kilocode","kilo-gateway","kimchi","kimi","kimi-coding","kiro","lemonade","letta","linkup","linkup-search","llamafile","llamagate","llm7","local-device","longcat","maritalk","mimo-free","minimax","minimax-cn","mistral","mmf","morph","nanobanana","nanobot","nanogpt","nebius","novita","nscale","nvidia","oai-cc","oai-r","ollama","ollama-local","omp","openai","openclaw","opencode","opencode-go","opendesign","openrouter","perplexity","perplexity-agent","perplexity-web","piapi","playht","poolside","predibase","qoder","qwen","recraft","reka","roo","runwayml","sambanova","sdwebui","searchapi","searxng","serper","siliconflow","stability-ai","tavily","tencent","together","tokenrouter","topaz","tortoise","trae","venice","vercel","vercel-ai-gateway","vertex","vertex-partner","volcengine-ark","voyage-ai","windsurf","workbuddy","xai","xiaomi-mimo","xiaomi-tokenplan","youcom","zed","zeroclaw","zoocode"]);

// Runtime only — first 404 remembers id for the whole session
const failedIds = new Set();

function normalizeId(providerId) {
  if (!providerId || typeof providerId !== "string") return "";
  return providerId.trim().toLowerCase();
}

/** Resolve icon file id (after alias). Empty if previously failed this session. */
export function resolveProviderIconId(providerId) {
  const id = normalizeId(providerId);
  if (!id) return "";
  if (failedIds.has(id)) return "";
  const aliased = ICON_ALIASES[id] || id;
  if (failedIds.has(aliased)) return "";
  return aliased;
}

/**
 * Return the best icon path for a provider:
 * - .png for providers with real logos
 * - .svg for all others (placeholder circle with initials)
 * Returns null when previously failed this session.
 */
export function getProviderIconSrc(providerId) {
  const id = resolveProviderIconId(providerId);
  if (!id) return null;
  const ext = PNG_PROVIDER_IDS.has(id) ? "png" : "svg";
  return `/providers/${id}.${ext}`;
}

/** Call from img onError so later mounts skip the request. */
export function markProviderIconMissing(providerId) {
  const id = normalizeId(providerId);
  if (id) failedIds.add(id);
  const aliased = ICON_ALIASES[id];
  if (aliased) failedIds.add(aliased);
}
