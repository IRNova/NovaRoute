export default {
  id: "kilo",
  alias: "kilo",
  display: {
    name: "Kilo AI",
    icon: "cloud_queue",
    color: "#06B6D4",
    textIcon: "KILO",
    website: "https://kilo.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.kilo.ai/api/gateway/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
    { id: "openai/gpt-4o", name: "GPT-4o" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "mistral/mistral-large", name: "Mistral Large" },
    { id: "xai/grok-3", name: "Grok 3" },
  ],
  passthroughModels: true,
};
