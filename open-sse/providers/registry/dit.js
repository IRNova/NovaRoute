export default {
  id: "dit",
  alias: "dai",
  display: {
    name: "DIT.ai",
    icon: "hub",
    color: "#0EA5E9",
    textIcon: "DT",
    website: "https://dit.ai",
  },
  category: "apikey",
  authHint: "Use your dit.ai API key in Authorization: Bearer <key>. Fully OpenAI-compatible — a drop-in replacement, just change the base URL to https://api.dit.ai/v1.",
  transport: {
    baseUrl: "https://api.dit.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.dit.ai/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "gpt-5.4",
      name: "GPT-5.4 (DIT.ai)",
      toolCalling: true,
      supportsReasoning: true,
      supportsVision: true,
      contextLength: 400000,
    },
    {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6 (DIT.ai)",
      toolCalling: true,
      supportsReasoning: true,
      supportsVision: true,
      contextLength: 200000,
    },
  ],
};
