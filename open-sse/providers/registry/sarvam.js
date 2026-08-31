export default {
  id: "sarvam",
  alias: "sarvam",
  hasFree: true,
  display: {
    name: "Sarvam AI",
    icon: "public",
    color: "#0EA5E9",
    textIcon: "SV",
    website: "https://docs.sarvam.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.sarvam.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "sarvam-105b",
      name: "Sarvam 105B",
      contextLength: 131072,
    },
    {
      id: "sarvam-30b",
      name: "Sarvam 30B",
      contextLength: 65536,
    },
  ],
};
