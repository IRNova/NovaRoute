export default {
  id: "g0i",
  alias: "g0i",
  display: {
    name: "G0I",
    icon: "cloud_queue",
    color: "#F43F5E",
    textIcon: "G0I",
    website: "https://g0i.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://g0i.ai/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
    { id: "o3", name: "O3" },
    { id: "qwen3-235b", name: "Qwen3 235B" },
  ],
  passthroughModels: true,
};
