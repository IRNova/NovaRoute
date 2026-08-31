export default {
  id: "inception",
  alias: "inception",
  hasFree: true,
  display: {
    name: "Inception",
    icon: "auto_awesome",
    color: "#F97316",
    textIcon: "IN",
    website: "https://docs.inceptionlabs.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.inceptionlabs.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "mercury-2",
      name: "Mercury 2",
      maxOutputTokens: 50000,
      contextLength: 128000,
    },
  ],
};
