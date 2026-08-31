export default {
  id: "freetheai",
  alias: "fta",
  hasFree: true,
  display: {
    name: "FreeTheAi",
    icon: "hub",
    color: "#22C55E",
    textIcon: "FTA",
    website: "https://freetheai.xyz",
  },
  category: "apikey",
  authHint: "Join the FreeTheAi Discord to get your free API key.",
  transport: {
    baseUrl: "https://api.freetheai.xyz/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.freetheai.xyz/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      contextLength: 128000,
    },
    {
      id: "llama-3.3-70b-instruct",
      name: "Llama 3.3 70B",
      contextLength: 128000,
    },
    {
      id: "deepseek-chat",
      name: "DeepSeek Chat",
      contextLength: 128000,
    },
  ],
  passthroughModels: true,
};
