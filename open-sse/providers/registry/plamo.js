export default {
  id: "plamo",
  alias: "plamo",
  display: {
    name: "PLaMo",
    icon: "public",
    color: "#DC2626",
    textIcon: "PL",
    website: "https://plamo.preferredai.jp/api",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.platform.preferredai.jp/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "plamo-3.0-prime",
      name: "PLaMo 3.0 Prime",
      maxOutputTokens: 20000,
      contextLength: 262144,
    },
  ],
};
