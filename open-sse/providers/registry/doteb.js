export default {
  id: "doteb",
  alias: "doteb",
  display: {
    name: "Doteb",
    icon: "cloud_queue",
    color: "#A855F7",
    textIcon: "DOTB",
    website: "https://doteb.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.doteb.com/chat/completions",
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
    { id: "deepseek-3.2", name: "DeepSeek 3.2" },
    { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
  ],
  passthroughModels: true,
};
