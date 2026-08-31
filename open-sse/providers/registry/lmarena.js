export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "lmarena",
  alias: "lma",
  hasFree: true,
  display: {
    name: "Arena (Free)",
    icon: "auto_awesome",
    color: "#FF6B6B",
    textIcon: "AR",
    website: "https://arena.ai",
  },
  category: "webCookie",
  authHint: "Paste the full Cookie header from arena.ai (DevTools ? Network ? request ? Cookie). Include arena-auth-prod-v1.0/.1? and cf_clearance/__cf_bm when present. Nova Route uses Chrome TLS impersonation; if Arena still 403s, set providerSpecificData.recaptchaV3Token from a live browser session.",
  cookieHint: "Open DevTools ? Network ? any request to arena.ai ? copy full Cookie header (include arena-auth-prod-v1.0)",
  transport: {
    baseUrl: "https://arena.ai/nextjs-api/stream/create-evaluation",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "amazon.nova-pro-v1:0",
      name: "amazon.nova-pro-v1:0",
      supportsVision: true,
    },
    {
      id: "claude-haiku-4-5-20251001",
      name: "claude-haiku-4-5-20251001",
    },
    {
      id: "claude-sonnet-5",
      name: "claude-sonnet-5-high",
      supportsVision: true,
    },
    {
      id: "deepseek-v4-pro-thinking",
      name: "deepseek-v4-pro-thinking",
    },
    {
      id: "dola-seed-2.0-preview-vision",
      name: "dola-seed-2.0-preview-vision",
      supportsVision: true,
    },
    {
      id: "ernie-5.0-preview-1220",
      name: "ernie-5.0-preview-1220",
      supportsVision: true,
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "gemini-3.1-flash-lite",
      supportsVision: true,
    },
    {
      id: "gemini-3.1-pro-preview",
      name: "gemini-3.1-pro-preview",
      supportsVision: true,
    },
    {
      id: "gemini-3.5-flash-high",
      name: "gemini-3.5-flash-high",
      supportsVision: true,
    },
    {
      id: "significant-otter",
      name: "gemma-4-26b-a4b",
      supportsVision: true,
    },
    {
      id: "pteronura",
      name: "gemma-4-31b",
      supportsVision: true,
    },
    {
      id: "glm-5.1",
      name: "glm-5.2 (max)",
    },
    {
      id: "glm-5v-turbo",
      name: "glm-5v-turbo",
      supportsVision: true,
    },
    {
      id: "gpt-oss-120b",
      name: "gpt-oss-120b",
    },
    {
      id: "gpt-5.2-high",
      name: "gpt-5.2-high",
      supportsVision: true,
    },
    {
      id: "gpt-5.4-mini-high",
      name: "gpt-5.4-mini-high",
      supportsVision: true,
    },
    {
      id: "gpt-5.4-nano-high",
      name: "gpt-5.4-nano-high",
      supportsVision: true,
    },
    {
      id: "gpt-5.5-instant",
      name: "gpt-5.5-instant",
      supportsVision: true,
    },
    {
      id: "grok-4.3/text",
      name: "grok-4.5",
      supportsVision: true,
    },
    {
      id: "hunyuan-vision-1.5-thinking",
      name: "hunyuan-vision-1.5-thinking",
      supportsVision: true,
    },
    {
      id: "hy3",
      name: "hy3",
    },
    {
      id: "kimi-k2.6",
      name: "kimi-k2.6",
      supportsVision: true,
    },
    {
      id: "ling-2.5-1t",
      name: "ling-2.5-1t",
    },
    {
      id: "longcat-2.0",
      name: "longcat-2.0",
    },
    {
      id: "mercury-2",
      name: "mercury-2",
    },
    {
      id: "mimo-v2.5",
      name: "mimo-v2.5",
      supportsVision: true,
    },
    {
      id: "mimo-v2.5-pro",
      name: "mimo-v2.5-pro",
    },
    {
      id: "minimax-m3",
      name: "minimax-m3",
      supportsVision: true,
    },
    {
      id: "mistral-large-3",
      name: "mistral-large-3",
      supportsVision: true,
    },
    {
      id: "mistral-medium-3.5",
      name: "mistral-medium-3.5",
      supportsVision: true,
    },
    {
      id: "mistral-small-2603",
      name: "mistral-small-2603",
    },
    {
      id: "nova-2-lite",
      name: "nova-2-lite",
    },
    {
      id: "nvidia-nemotron-3-nano-30b-a3b-bf16",
      name: "nvidia-nemotron-3-nano-30b-a3b-bf16",
    },
    {
      id: "march26-chatbot1-public",
      name: "nvidia-nemotron-3-super-120b-a12b",
    },
    {
      id: "may26-chatbot4-public",
      name: "nvidia-nemotron-3-ultra-550b-a55b-nvfp4",
    },
    {
      id: "o3-2025-04-16",
      name: "o3-2025-04-16",
      supportsVision: true,
    },
    {
      id: "qwen3.5-397b-a17b",
      name: "qwen3.5-397b-a17b",
      supportsVision: true,
    },
    {
      id: "qwen3.7-max",
      name: "qwen3.7-max",
    },
    {
      id: "qwen3.7-plus",
      name: "qwen3.7-plus",
      supportsVision: true,
    },
    {
      id: "ring-2.5-1t",
      name: "ring-2.5-1t",
    },
    {
      id: "step-3.5-flash",
      name: "step-3.5-flash",
    },
    {
      id: "trinity-large-thinking",
      name: "trinity-large-thinking",
    },
    {
      id: "claude-sonnet-5-search",
      name: "claude-sonnet-5-search",
    },
    {
      id: "gemini-2.5-pro-grounding",
      name: "gemini-2.5-pro-grounding",
    },
    {
      id: "gemini-3-flash-grounding",
      name: "gemini-3-flash-grounding",
    },
    {
      id: "gpt-5.2-search",
      name: "gpt-5.2-search",
    },
    {
      id: "grok-4.3/search",
      name: "grok-4.3",
    },
    {
      id: "o3-search",
      name: "o3-search",
    },
  ],
  credentialFields: [
    { id: "cookie", label: "Full Cookie Header", placeholder: "arena-auth-prod-v1.0=xxx; cf_clearance=xxx", type: "textarea", required: true, hint: "Open DevTools > Network > any request to arena.ai > copy full Cookie header" },
  ],
};