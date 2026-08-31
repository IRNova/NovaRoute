export default {
  id: "unorouter",
  alias: "unorouter",
  hasFree: true,
  display: {
    name: "UnoRouter",
    icon: "unorouter",
    color: "#8B5CF6",
    textIcon: "UR",
    website: "https://unorouter.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.unorouter.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.unorouter.com/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
