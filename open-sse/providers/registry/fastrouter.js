export default {
  id: "fastrouter",
  alias: "fastrouter",
  hasFree: true,
  display: {
    name: "FastRouter",
    icon: "speed",
    color: "#F97316",
    textIcon: "FR",
    website: "https://fastrouter.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.fastrouter.ai/api/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.fastrouter.ai/api/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
