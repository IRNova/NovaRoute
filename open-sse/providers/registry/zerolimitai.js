export default {
  id: "zerolimitai",
  alias: "zerolimitai",
  hasFree: true,
  display: {
    name: "ZeroLimitAI",
    icon: "router",
    color: "#475569",
    textIcon: "ZL",
    website: "https://www.zerolimitai.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://www.zerolimitai.com/api/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://www.zerolimitai.com/api/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
