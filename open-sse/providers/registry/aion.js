export default {
  id: "aion",
  hasFree: true,
  display: {
    name: "Aion Labs",
    icon: "hub",
    color: "#0EA5E9",
    textIcon: "AI",
    website: "https://www.aionlabs.ai",
  },
  category: "apikey",
  authHint: "Create a free API key at aionlabs.ai (no card), then paste it here as a Bearer token.",
  transport: {
    baseUrl: "https://api.aionlabs.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.aionlabs.ai/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "aion-labs/aion-3.0",
      name: "Aion 3.0",
      contextLength: 131072,
    },
    {
      id: "aion-labs/aion-3.0-mini",
      name: "Aion 3.0 Mini",
      contextLength: 131072,
    },
    {
      id: "aion-labs/aion-2.5",
      name: "Aion 2.5",
      contextLength: 131072,
    },
    {
      id: "aion-labs/aion-2.0",
      name: "Aion 2.0",
      contextLength: 131072,
    },
    {
      id: "aion-labs/aion-rp-llama-3.1-8b",
      name: "Aion RP Llama 3.1 8B",
      contextLength: 32768,
    },
  ],
  passthroughModels: true,
};
