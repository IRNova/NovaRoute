export default {
  id: "ofoxai",
  alias: "ofoxai",
  hasFree: true,
  display: {
    name: "OfoxAI",
    icon: "router",
    color: "#0F766E",
    textIcon: "OF",
    website: "https://ofox.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.ofox.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.ofox.ai/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
