export default {
  id: "devin",
  alias: "devin",
  display: {
    name: "Devin",
    icon: "smart_toy",
    color: "#111827",
    textIcon: "DV",
    website: "https://devin.ai",
    notice: {
      apiKeyUrl: "https://app.devin.ai/settings/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: {
    baseUrl: "https://api.devin.ai/v1/chat/completions",
  },
  models: [],
  passthroughModels: true,
};
