export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "conol-web",
  alias: "cnl",
  display: {
    name: "Conol (Unofficial/Experimental)",
    icon: "auto_awesome",
    color: "#F6C945",
    textIcon: "CO",
    website: "https://conol.ai",
  },
  category: "webCookie",
  authHint: "Use browser sign-in, or paste the full Cookie header from conol.ai. The __Secure-better-auth.session_token cookie is required.",
  cookieHint: "Open DevTools ? Application ? Cookies ? conol.ai ? copy __Secure-better-auth.session_token",
  transport: {
    baseUrl: "https://conol.ai/api/sessions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "claude-opus-5",
      name: "Claude Opus 5",
      supportsVision: true,
    },
    {
      id: "claude-opus-4-8",
      name: "Claude Opus 4 8",
      supportsVision: true,
    },
    {
      id: "claude-fable-5",
      name: "Claude Fable 5",
      supportsVision: true,
    },
    {
      id: "claude-opus-4-7",
      name: "Claude Opus 4 7",
      supportsVision: true,
    },
    {
      id: "claude-sonnet-5",
      name: "Claude Sonnet 5",
      supportsVision: true,
    },
    {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4 6",
      supportsVision: true,
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude Haiku 4 5",
      supportsVision: true,
    },
    {
      id: "gpt-5.5",
      name: "GPT 5.5",
      supportsVision: true,
    },
    {
      id: "gpt-5.5-pro",
      name: "GPT 5.5 Pro",
      supportsVision: true,
    },
    {
      id: "gpt-5.6-sol",
      name: "GPT 5.6 Sol",
      supportsVision: true,
    },
    {
      id: "gpt-5.6-terra",
      name: "GPT 5.6 Terra",
      supportsVision: true,
    },
    {
      id: "gpt-5.6-luna",
      name: "GPT 5.6 Luna",
      supportsVision: true,
    },
    {
      id: "deepseek/deepseek-v4-pro",
      name: "Deepseek V4 Pro",
      supportsVision: false,
    },
    {
      id: "openrouter/fusion",
      name: "Fusion",
      supportsVision: false,
    },
    {
      id: "z-ai/glm-5.2",
      name: "GLM 5.2",
      supportsVision: false,
    },
    {
      id: "z-ai/glm-5.1",
      name: "GLM 5.1",
      supportsVision: false,
    },
    {
      id: "tencent/hy3",
      name: "Hy3",
      supportsVision: false,
    },
    {
      id: "moonshotai/kimi-k3",
      name: "Kimi K3",
      supportsVision: true,
    },
    {
      id: "moonshotai/kimi-k2.7-code",
      name: "Kimi K2.7 Code",
      supportsVision: true,
    },
    {
      id: "qwen/qwen3.7-plus",
      name: "Qwen3.7 Plus",
      supportsVision: true,
    },
    {
      id: "qwen/qwen3.7-max",
      name: "Qwen3.7 Max",
      supportsVision: false,
    },
    {
      id: "minimax/minimax-m3",
      name: "Minimax M3",
      supportsVision: true,
    },
    {
      id: "stepfun/step-3.7-flash",
      name: "Step 3.7 Flash",
      supportsVision: true,
    },
    {
      id: "google/gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
      supportsVision: true,
    },
    {
      id: "google/gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro Preview",
      supportsVision: true,
    },
    {
      id: "google/gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash Lite",
      supportsVision: true,
    },
    {
      id: "x-ai/grok-4.3",
      name: "Grok 4.3",
      supportsVision: true,
    },
    {
      id: "deepseek/deepseek-v4-flash",
      name: "Deepseek V4 Flash",
      supportsVision: false,
    },
    {
      id: "xiaomi/mimo-v2.5",
      name: "Mimo V2.5",
      supportsVision: true,
    },
    {
      id: "xiaomi/mimo-v2.5-pro",
      name: "Mimo V2.5 Pro",
      supportsVision: false,
    },
  ],
  passthroughModels: true,
  credentialFields: [
    { id: "token", label: "Session Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Application > Cookies > conol.ai > copy __Secure-better-auth.session_token" },
  ],
};