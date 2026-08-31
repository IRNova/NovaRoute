export default {
  id: "zylo-api",
  alias: "zylo",
  hasFree: true,
  display: {
    name: "Zylo API",
    icon: "hub",
    color: "#2563EB",
    textIcon: "ZY",
    website: "https://zyloai.net",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.zyloai.net/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.zyloai.net/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
