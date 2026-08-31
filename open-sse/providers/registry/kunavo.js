export default {
  id: "kunavo",
  alias: "kunavo",
  display: {
    name: "Kunavo",
    icon: "cloud_queue",
    color: "#F59E0B",
    textIcon: "KNVO",
    website: "https://kunavo.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.kunavo.com/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "gemini-2-5-flash", name: "Gemini 2.5 Flash" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-image", name: "GPT Image" },
    { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
  ],
  passthroughModels: true,
};
