export default {
  id: "electronhub",
  alias: "electronhub",
  hasFree: true,
  display: {
    name: "Electron Hub",
    icon: "hub",
    color: "#22C55E",
    textIcon: "EH",
    website: "https://www.electronhub.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.electronhub.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.electronhub.ai/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
