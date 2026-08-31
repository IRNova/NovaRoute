export default {
  id: "routra",
  alias: "routra",
  display: {
    name: "Routra",
    icon: "cloud_queue",
    color: "#EC4899",
    textIcon: "ROTR",
    website: "https://routra.dev",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.routra.dev/chat/completions",
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
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
  ],
  passthroughModels: true,
};
