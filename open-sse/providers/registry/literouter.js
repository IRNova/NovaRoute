export default {
  id: "literouter",
  alias: "literouter",
  hasFree: true,
  display: {
    name: "LiteRouter",
    icon: "router",
    color: "#2563EB",
    textIcon: "LR",
    website: "https://literouter.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.literouter.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.literouter.com/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
