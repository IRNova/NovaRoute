export default {
  id: "chenzk",
  alias: "chenzk",
  display: {
    name: "Chenzk API",
    icon: "hub",
    color: "#10B981",
    textIcon: "CZ",
    website: "https://chenzk.top",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://chenzk.top/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://chenzk.top/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
