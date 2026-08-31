export default {
  id: "mimocode",
  alias: "mcode",
  hasFree: true,
  display: {
    name: "MiMoCode (Free)",
    icon: "devices",
    color: "#FF6B35",
    textIcon: "MC",
    website: "https://mimo.mi.com",
    notice: {
      text: "MiMoCode uses Xiaomi's public free AI endpoint with bootstrap-based JWT authentication. No signup needed. Rate limits apply.",
    },
  },
  category: "free",
  noAuth: true,
  authHint: "No API key required. The executor auto-generates JWT tokens via device fingerprint bootstrap.",
  transport: {
    baseUrl: "https://api.xiaomimimo.com",
    chatPath: "/api/free-ai/openai/chat",
    authType: "none",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  serviceKinds: [
    "llm",
  ],
  models: [
    {
      id: "mimo-auto",
      name: "MiMo Auto",
      maxOutputTokens: 128000,
      contextLength: 1000000,
    },
  ],
};
