export default {
  id: "void-ai",
  alias: "void-ai",
  hasFree: true,
  display: {
    name: "Void AI",
    icon: "science",
    color: "#111827",
    textIcon: "VA",
    website: "https://voidai.app",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.voidai.app/v1/chat/completions",
    responsesUrl: "https://api.voidai.app/v1/responses",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.voidai.app/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
