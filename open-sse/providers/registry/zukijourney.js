export default {
  id: "zukijourney",
  alias: "zukijourney",
  hasFree: true,
  display: {
    name: "Zukijourney",
    icon: "cloud_queue",
    color: "#7C3AED",
    textIcon: "ZJ",
    website: "https://github.com/zukijourney/api-oss/",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.zukijourney.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-opus", name: "Claude 3 Opus" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "flux-kontext", name: "Flux Kontext" },
    { id: "gpt-image-1", name: "GPT Image 1" },
  ],
  passthroughModels: true,
};
