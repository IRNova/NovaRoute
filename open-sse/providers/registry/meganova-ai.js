export default {
  id: "meganova-ai",
  alias: "meganova-ai",
  hasFree: true,
  display: {
    name: "MegaNova AI",
    icon: "router",
    color: "#7C3AED",
    textIcon: "MN",
    website: "https://meganova.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.meganova.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.meganova.ai/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
