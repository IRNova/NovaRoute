export default {
  id: "navyapi",
  alias: "navyapi",
  hasFree: true,
  display: {
    deprecated: true,
    deprecationNotice: "Duplicate provider — use \"navy\" instead.",
    name: "NavyAPI",
    icon: "cloud_queue",
    color: "#2563EB",
    textIcon: "NVY",
    website: "https://api.navy",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.navy/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "flux-kontext", name: "Flux Kontext" },
  ],
  passthroughModels: true,
};
