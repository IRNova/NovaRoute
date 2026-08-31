export default {
  id: "mnn",
  alias: "mnn",
  hasFree: true,
  display: {
    name: "MNN",
    icon: "cloud_queue",
    color: "#6366F1",
    textIcon: "MNN",
    website: "https://mnnai.ru",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.mnnai.ru/v1/chat/completions",
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
    { id: "gpt-image-1", name: "GPT Image 1" },
    { id: "flux-kontext", name: "Flux Kontext" },
  ],
  passthroughModels: true,
};
