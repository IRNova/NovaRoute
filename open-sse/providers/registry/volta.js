export default {
  id: "volta",
  alias: "volta",
  hasFree: true,
  display: {
    name: "VoltAI",
    icon: "cloud_queue",
    color: "#F97316",
    textIcon: "VLT",
    website: "https://voltaisite.onrender.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.voltapi.online/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "flux-kontext", name: "Flux Kontext" },
  ],
  passthroughModels: true,
};
