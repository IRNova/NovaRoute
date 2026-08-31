export default {
  id: "nagaai",
  alias: "nagaai",
  hasFree: true,
  display: {
    name: "NagaAI",
    icon: "cloud_queue",
    color: "#10B981",
    textIcon: "NAGA",
    website: "https://naga.ac",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.naga.ac/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
  ],
  passthroughModels: true,
};
