export default {
  id: "auriko",
  alias: "auriko",
  hasFree: true,
  display: {
    name: "Auriko",
    icon: "hub",
    color: "#0891B2",
    textIcon: "AU",
    website: "https://www.auriko.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.auriko.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.auriko.ai/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
