export default {
  id: "poe",
  alias: "poe",
  display: {
    name: "Poe",
    icon: "hub",
    color: "#F97316",
    textIcon: "PO",
    website: "https://creator.poe.com/api-reference",
  },
  category: "apikey",
  authHint: "Bearer API key for the Poe OpenAI-compatible API.",
  transport: {
    baseUrl: "https://api.poe.com/v1/chat/completions",
    responsesUrl: "https://api.poe.com/v1/responses",
    messagesUrl: "https://api.poe.com/v1/messages",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "gpt-5.2",
      name: "GPT-5.2",
    },
    {
      id: "claude-opus-4.8",
      name: "Claude Opus 4.8",
      targetFormat: "claude",
    },
    {
      id: "gemini-3.0-pro",
      name: "Gemini 3.0 Pro",
    },
  ],
  passthroughModels: true,
};
