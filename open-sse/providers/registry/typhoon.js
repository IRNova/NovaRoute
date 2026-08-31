export default {
  id: "typhoon",
  alias: "typhoon",
  hasFree: true,
  display: {
    name: "Typhoon",
    icon: "public",
    color: "#7C3AED",
    textIcon: "TY",
    website: "https://docs.opentyphoon.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.opentyphoon.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "typhoon-v2.5-30b-a3b-instruct",
      name: "Typhoon v2.5 30B A3B Instruct",
      contextLength: 131072,
    },
  ],
};
