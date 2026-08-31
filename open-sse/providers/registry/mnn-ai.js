export default {
  id: "mnn-ai",
  alias: "mnn-ai",
  hasFree: true,
  display: {
    deprecated: true,
    deprecationNotice: "Duplicate provider — use \"mnn\" instead.",
    name: "MNN AI",
    icon: "hub",
    color: "#0F766E",
    textIcon: "MNN",
    website: "https://mnnai.ru",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.mnnai.ru/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.mnnai.ru/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
