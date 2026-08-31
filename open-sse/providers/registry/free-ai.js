export default {
  id: "free-ai",
  alias: "free-ai",
  hasFree: true,
  display: {
    name: "Free.ai",
    icon: "hub",
    color: "#16A34A",
    textIcon: "FA",
    website: "https://free.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.free.ai/v1/chat/",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.free.ai/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
