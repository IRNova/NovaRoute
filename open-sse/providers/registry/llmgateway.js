export default {
  id: "llmgateway",
  alias: "llmgateway",
  hasFree: true,
  display: {
    name: "LLM Gateway",
    icon: "router",
    color: "#6366F1",
    textIcon: "LG",
    website: "https://llmgateway.io",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.llmgateway.io/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.llmgateway.io/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
