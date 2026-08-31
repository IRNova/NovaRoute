export default {
  id: "anyapi",
  alias: "anyapi",
  hasFree: true,
  display: {
    name: "AnyAPI AI",
    icon: "hub",
    color: "#0EA5E9",
    textIcon: "AA",
    website: "https://anyapi.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.anyapi.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.anyapi.ai/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
