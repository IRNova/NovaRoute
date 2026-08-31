export default {
  id: "chat-oripe",
  alias: "chat-oripe",
  hasFree: true,
  display: {
    name: "Chat Oripe",
    icon: "router",
    color: "#64748B",
    textIcon: "CO",
    website: "https://api.oriper.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.oriper.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.oriper.com/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
