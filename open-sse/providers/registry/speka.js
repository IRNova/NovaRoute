export default {
  id: "speka",
  alias: "speka",
  hasFree: true,
  display: {
    name: "Speka AI",
    icon: "router",
    color: "#DB2777",
    textIcon: "SP",
    website: "https://speka.me",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://speka.me/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://speka.me/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
