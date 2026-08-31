export default {
  id: "kenari",
  alias: "kenari",
  display: {
    name: "Kenari",
    icon: "hub",
    color: "#B5362A",
    textIcon: "KN",
    website: "https://kenari.id",
  },
  category: "apikey",
  authHint: "Use your Kenari API key (kn-...) in Authorization: Bearer <key>. Fully OpenAI-compatible. API base URL: https://kenari.id/v1.",
  transport: {
    baseUrl: "https://kenari.id/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://kenari.id/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
