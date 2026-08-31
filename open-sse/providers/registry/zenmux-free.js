export default {
  id: "zenmux-free",
  alias: "zmf",
  hasFree: true,
  display: {
    name: "ZenMux Free (Web)",
    icon: "bolt",
    color: "#667eea",
    textIcon: "ZF",
    website: "https://zenmux.ai",
  },
  category: "webCookie",
  authHint: "Login at zenmux.ai, then export all cookies using EditThisCookie or Cookie-Editor and paste the full Cookie header string here. Refresh every ~30 days.",
  cookieHint: "Login at zenmux.ai → export full Cookie header using EditThisCookie or Cookie-Editor",
  transport: {
    baseUrl: "https://zenmux.ai/api/anthropic/v1/messages",
    // Endpoint is an Anthropic Messages API — declaring "openai" made the
    // gateway POST OpenAI-shaped bodies to it (guaranteed 400s).
    format: "claude",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "deepseek/deepseek-chat",
      name: "DeepSeek V3.2 (Non-thinking)",
    },
    {
      id: "deepseek/deepseek-reasoner",
      name: "DeepSeek V3.2 (Thinking)",
      supportsReasoning: true,
    },
    {
      id: "deepseek/deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      supportsReasoning: true,
    },
    {
      id: "kuaishou/kat-coder-pro-v1-free",
      name: "KAT Coder Pro V1 Free",
    },
    {
      id: "z-ai/glm-4.7-flash-free",
      name: "GLM 4.7 Flash Free",
    },
    {
      id: "stepfun/step-3.5-flash-free",
      name: "Step 3.5 Flash Free",
    },
    {
      id: "inclusionai/ling-1t",
      name: "Ling 1T",
    },
    {
      id: "inclusionai/ling-mini-2.0",
      name: "Ling Mini 2.0",
    },
    {
      id: "inclusionai/ring-1t",
      name: "Ring 1T",
    },
    {
      id: "sapiens-ai/agnes-1.5-lite",
      name: "Agnes 1.5 Lite",
    },
    {
      id: "sapiens-ai/agnes-1.5-pro",
      name: "Agnes 1.5 Pro",
    },
  ],
  credentialFields: [
    { id: "cookie", label: "Full Cookie Header", placeholder: "session=xxx; other=val", type: "textarea", required: true, hint: "Login at zenmux.ai > export full Cookie header using EditThisCookie or Cookie-Editor" },
  ],
};