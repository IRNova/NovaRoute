export default {
  id: "mixlayer",
  alias: "mixlayer",
  hasFree: true,
  display: {
    name: "Mixlayer",
    icon: "router",
    color: "#0EA5E9",
    textIcon: "MX",
    website: "https://www.mixlayer.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://models.mixlayer.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://models.mixlayer.ai/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "qwen/qwen3.5-4b-free",
      name: "Qwen 3.5 4B (free)",
    },
  ],
  passthroughModels: true,
};
