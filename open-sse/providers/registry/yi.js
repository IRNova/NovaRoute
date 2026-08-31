export default {
  id: "yi",
  alias: "yi",
  display: {
    name: "Yi (01.AI)",
    icon: "auto_awesome",
    color: "#10B981",
    textIcon: "YI",
    website: "https://01.ai",
  },
  category: "apikey",
  authHint: "Get API key at platform.lingyiwanwu.com",
  transport: {
    baseUrl: "https://api.lingyiwanwu.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "yi-large",
      name: "Yi Large",
    },
  ],
  passthroughModels: true,
};
