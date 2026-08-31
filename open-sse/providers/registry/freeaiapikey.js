export default {
  id: "freeaiapikey",
  alias: "faik",
  display: {
    name: "FreeAIAPIKey",
    icon: "vpn_key",
    color: "#F59E0B",
    textIcon: "FK",
    website: "https://freeaiapikey.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://freeaiapikey.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://freeaiapikey.com/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "openai/gpt-5",
      name: "GPT-5 (via FreeAIAPIKey)",
      contextLength: 400000,
    },
    {
      id: "openai/gpt-4o",
      name: "GPT-4o (via FreeAIAPIKey)",
      contextLength: 128000,
    },
    {
      id: "openai/gpt-5.2-codex",
      name: "GPT-5.2 Codex (via FreeAIAPIKey)",
      contextLength: 128000,
    },
    {
      id: "anthropic/claude-opus-4.6",
      name: "Claude Opus 4.6 (via FreeAIAPIKey)",
      contextLength: 1000000,
    },
    {
      id: "anthropic/claude-sonnet-4.6",
      name: "Claude Sonnet 4.6 (via FreeAIAPIKey)",
      contextLength: 1000000,
    },
    {
      id: "Alibaba/qwen3.5",
      name: "Qwen 3.5 (via FreeAIAPIKey)",
      contextLength: 128000,
    },
    {
      id: "Alibaba/qwen3-vl:235b",
      name: "Qwen 3 VL 235B (via FreeAIAPIKey)",
      contextLength: 128000,
    },
  ],
};
