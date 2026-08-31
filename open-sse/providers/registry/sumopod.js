export default {
  id: "sumopod",
  alias: "sumopod",
  display: {
    name: "SumoPod",
    icon: "router",
    color: "#2563EB",
    textIcon: "SP",
    website: "https://ai.sumopod.com",
  },
  category: "apikey",
  authHint: "Use your SumoPod API key (sk-...) in Authorization: Bearer <key>. Fully OpenAI-compatible. API base URL: https://ai.sumopod.com/v1.",
  transport: {
    baseUrl: "https://ai.sumopod.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://ai.sumopod.com/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
