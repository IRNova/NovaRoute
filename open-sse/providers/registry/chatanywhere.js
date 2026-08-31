export default {
  id: "chatanywhere",
  alias: "chatanywhere",
  hasFree: true,
  display: {
    name: "ChatAnywhere",
    icon: "router",
    color: "#2563EB",
    textIcon: "CA",
    website: "https://chatanywhere.tech",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.chatanywhere.org/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.chatanywhere.org/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
