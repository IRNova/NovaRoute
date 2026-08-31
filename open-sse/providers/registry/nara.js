export default {
  id: "nara",
  hasFree: true,
  display: {
    name: "NaraRouter",
    icon: "hub",
    color: "#EC4899",
    textIcon: "NA",
    website: "https://bynara.id",
  },
  category: "apikey",
  authHint: "Get a free API key via NaraRouter's Telegram channel, then paste it here as a Bearer token.",
  transport: {
    baseUrl: "https://router.bynara.id/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "tencent-hy3",
      name: "Tencent Hy3",
      contextLength: 1000000,
    },
    {
      id: "mistral-large",
      name: "Mistral Large",
      toolCalling: true,
      contextLength: 252000,
    },
    {
      id: "mistral-medium-3-5",
      name: "Mistral Medium 3.5",
      toolCalling: true,
      supportsVision: true,
      contextLength: 256000,
    },
  ],
  passthroughModels: true,
};
