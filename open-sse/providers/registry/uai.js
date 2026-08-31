export default {
  id: "uai",
  alias: "uai",
  display: {
    name: "UAI",
    icon: "cloud_queue",
    color: "#0EA5E9",
    textIcon: "UAI",
    website: "https://uai.sh",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://uai.sh/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini" },
    { id: "openai/gpt-5-chat", name: "GPT-5 Chat" },
    { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6" },
    { id: "meta-llama/llama-3.3-70b", name: "Llama 3.3 70B" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
    { id: "qwen/qwen3-235b", name: "Qwen3 235B" },
  ],
  passthroughModels: true,
};
