export default {
  id: "coze",
  alias: "coze",
  hasFree: true,
  display: {
    name: "Coze",
    icon: "smart_toy",
    color: "#3B82F6",
    textIcon: "CZ",
    website: "https://coze.com",
  },
  category: "apikey",
  authHint: "Get API key at coze.com/open/api",
  transport: {
    baseUrl: "https://api.coze.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "claude-3-7-sonnet-20250514",
      name: "Claude 3.7 Sonnet",
    },
  ],
  passthroughModels: true,
};
