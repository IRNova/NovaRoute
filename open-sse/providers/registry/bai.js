export default {
  id: "bai",
  alias: "bai",
  display: {
    name: "b.ai",
    icon: "hub",
    color: "#6366F1",
    textIcon: "BA",
    website: "https://b.ai",
  },
  category: "apikey",
  authHint: "Bearer API key for the b.ai OpenAI-compatible LLM gateway (distinct from TheB.AI). Create a key at https://docs.b.ai, then use https://api.b.ai/v1 as the OpenAI-compatible base URL.",
  transport: {
    baseUrl: "https://api.b.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.b.ai/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
