export default {
  id: "zanityai",
  alias: "zanityai",
  hasFree: true,
  display: {
    name: "ZanityAI",
    icon: "cloud_queue",
    color: "#F59E0B",
    textIcon: "ZNTY",
    website: "https://docs.zanity.xyz",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.zanity.xyz/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "deepseek-r1", name: "DeepSeek R1" },
    { id: "gpt-4o", name: "GPT-4o" },
  ],
  passthroughModels: true,
};
