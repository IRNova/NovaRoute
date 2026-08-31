export default {
  id: "x5lab",
  alias: "x5lab",
  display: {
    name: "X5Lab",
    icon: "router",
    color: "#7C3AED",
    textIcon: "X5",
    website: "https://x5lab.dev",
  },
  category: "apikey",
  authHint: "Use your X5Lab API key (x5-...) in Authorization: Bearer <key>. Fully OpenAI-compatible. API base URL: https://api.x5lab.dev/v1.",
  transport: {
    baseUrl: "https://api.x5lab.dev/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.x5lab.dev/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
