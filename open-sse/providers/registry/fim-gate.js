export default {
  id: "fim-gate",
  alias: "fim-gate",
  display: {
    name: "FIM Gate",
    icon: "cloud_queue",
    color: "#14B8A6",
    textIcon: "FIMG",
    website: "https://gate.fim.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.fim.ai/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
    { id: "gpt-4o", name: "GPT-4o" },
  ],
  passthroughModels: true,
};
