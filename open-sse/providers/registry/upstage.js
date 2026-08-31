export default {
  id: "upstage",
  alias: "upstage",
  display: {
    name: "Upstage",
    icon: "trending_up",
    color: "#0F766E",
    textIcon: "UP",
    website: "https://www.upstage.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.upstage.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "solar-pro3",
      name: "solar-pro3",
    },
    {
      id: "solar-mini",
      name: "solar-mini",
    },
  ],
};
