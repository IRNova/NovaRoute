export default {
  id: "poixe-ai",
  alias: "poixe-ai",
  hasFree: true,
  display: {
    name: "Poixe AI",
    icon: "router",
    color: "#EA580C",
    textIcon: "PX",
    website: "https://poixe.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.poixe.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.poixe.com/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
