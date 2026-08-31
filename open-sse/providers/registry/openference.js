export default {
  id: "openference",
  alias: "of",
  // Duplicate of the canonical card / no connect handler yet - hidden from UI
  hasFree: true,
  display: {
    name: "Openference",
    icon: "openference",
    color: "#6366F1",
    textIcon: "OF",
    website: "https://openference.com",
  },
  category: "oauth",
  authHint: "Sign in with your Openference account to route requests through api.openference.com. An active plan is required for inference ??? OAuth may authenticate but return 402 without one.",
  transport: {
    baseUrl: "https://api.openference.com/v1/chat/completions",
    responsesUrl: "https://api.openference.com/v1/responses",
    authType: "oauth",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  oauth: {
    tokenUrl: "https://openference.com/oauth/token",
    clientId: "omniroute",
  },
  models: [
    {
      id: "GLM-5.2",
      name: "GLM 5.2",
      contextLength: 850000,
    },
  ],
  passthroughModels: true,
};
