export default {
  id: "helixmind",
  alias: "helixmind",
  display: {
    name: "HelixMind",
    icon: "hub",
    color: "#4F46E5",
    textIcon: "HM",
    website: "https://helixmind.online",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://helixmind.online/v1/chat/completions",
    responsesUrl: "https://helixmind.online/v1/responses",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://helixmind.online/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
