export default {
  id: "askcodi",
  alias: "askcodi",
  display: {
    name: "AskCodi",
    icon: "cloud_queue",
    color: "#22C55E",
    textIcon: "ACDI",
    website: "https://www.askcodi.com",
  },
  category: "apikey",
  hasFree: true,
  transport: {
    baseUrl: "https://api.askcodi.com/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "claude-4.5-sonnet", name: "Claude 4.5 Sonnet" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-5.1", name: "GPT-5.1" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "grok-4", name: "Grok 4" },
    { id: "llama-4", name: "Llama 4" },
    { id: "deepseek-v3", name: "DeepSeek V3" },
  ],
  passthroughModels: true,
};
