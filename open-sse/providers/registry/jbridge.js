export default {
  id: "jbridge",
  alias: "jbridge",
  display: {
    name: "JBridge",
    icon: "cloud_queue",
    color: "#10B981",
    textIcon: "JBRG",
    website: "https://jbridge.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://jbridge.ai/api/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "grok-4", name: "Grok 4" },
    { id: "kimi-k3", name: "Kimi K3" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ],
  passthroughModels: true,
};
