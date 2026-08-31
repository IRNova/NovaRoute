export default {
  id: "kie",
  alias: "kie",
  display: {
    name: "KIE.AI",
    icon: "hub",
    color: "#2563EB",
    textIcon: "KIE",
    website: "https://kie.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.kie.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "claude-opus-4-8",
      name: "Claude 4.8 Opus",
      contextLength: 128000,
    },
    {
      id: "claude-opus-4-7",
      name: "Claude 4.7 Opus",
      contextLength: 128000,
    },
    {
      id: "claude-sonnet-4-6",
      name: "Claude 4.6 Sonnet",
      contextLength: 128000,
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude 4.5 Haiku",
      contextLength: 128000,
    },
    {
      id: "gpt-5-5",
      name: "GPT 5.5",
      contextLength: 128000,
    },
    {
      id: "gpt-5-4",
      name: "GPT 5.4",
      contextLength: 128000,
    },
    {
      id: "gpt-5-2",
      name: "GPT 5.2",
      contextLength: 128000,
    },
    {
      id: "gemini-3-1-pro",
      name: "Gemini 3.1 Pro",
      contextLength: 128000,
    },
    {
      id: "gemini-2-5-pro",
      name: "Gemini 2.5 Pro",
      contextLength: 128000,
    },
    {
      id: "gemini-3-flash",
      name: "Gemini 3 Flash",
      contextLength: 128000,
    },
    {
      id: "gemini-3-5-flash",
      name: "Gemini 3.5 Flash",
      contextLength: 128000,
    },
  ],
};
