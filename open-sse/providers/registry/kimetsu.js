export default {
  id: "kimetsu",
  alias: "kimetsu",
  hasFree: true,
  display: {
    name: "Kimetsu",
    icon: "cloud_queue",
    color: "#EF4444",
    textIcon: "KMTS",
    website: "https://kimetsu.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.kimetsu.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  ],
  passthroughModels: true,
};
