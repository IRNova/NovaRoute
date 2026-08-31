export default {
  id: "llmrelay",
  alias: "llmrelay",
  display: {
    name: "LLMRelay",
    icon: "cloud_queue",
    color: "#6366F1",
    textIcon: "LLMR",
    website: "https://llmrelay.dev",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.llmrelay.dev/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
  ],
  passthroughModels: true,
};
