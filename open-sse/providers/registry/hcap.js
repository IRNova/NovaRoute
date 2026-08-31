export default {
  id: "hcap",
  alias: "hcap",
  hasFree: true,
  display: {
    name: "HCAP",
    icon: "cloud_queue",
    color: "#8B5CF6",
    textIcon: "HCAP",
    website: "https://hcap.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://hcap.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "gpt-image-1", name: "GPT Image 1" },
  ],
  passthroughModels: true,
};
