export default {
  id: "requesty",
  alias: "requesty",
  hasFree: true,
  display: {
    name: "Requesty",
    icon: "router",
    color: "#6366F1",
    textIcon: "RQ",
    website: "https://requesty.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://router.requesty.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://router.requesty.ai/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
