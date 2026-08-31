export default {
  id: "liquid",
  alias: "liquid",
  hasFree: true,
  display: {
    name: "Liquid AI",
    icon: "water_drop",
    color: "#06B6D4",
    textIcon: "LQ",
    website: "https://liquid.ai",
  },
  category: "apikey",
  authHint: "Get API key at liquid.ai",
  transport: {
    baseUrl: "https://inference.liquid.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://inference.liquid.ai/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "liquid-lfm-40b",
      name: "Liquid LFM 40B",
    },
  ],
  passthroughModels: true,
};
