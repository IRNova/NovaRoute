export default {
  id: "dify",
  alias: "dify",
  hasFree: true,
  display: {
    name: "Dify",
    icon: "smart_toy",
    color: "#6366F1",
    textIcon: "DF",
    website: "https://dify.ai",
  },
  category: "apikey",
  authHint: "Get API key from your Dify instance.",
  transport: {
    baseUrl: "https://api.dify.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "auto",
      name: "Auto",
    },
  ],
  passthroughModels: true,
};
