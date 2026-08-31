export default {
  id: "factory",
  alias: "factory",
  display: {
    name: "Factory",
    icon: "smart_toy",
    color: "#0F172A",
    textIcon: "FA",
    website: "https://factory.ai",
  },
  category: "apikey",
  authHint: "Bearer API key for the Factory OpenAI-compatible gateway.",
  transport: {
    baseUrl: "https://api.factory.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "auto",
      name: "Factory Auto (best model)",
    },
  ],
  passthroughModels: true,
};
