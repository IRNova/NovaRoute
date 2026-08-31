export default {
  id: "haiper",
  alias: "hp",
  display: {
    name: "Haiper",
    icon: "videocam",
    color: "#6366F1",
    textIcon: "HP",
    website: "https://haiper.ai",
  },
  category: "apikey",
  authHint: "Get API key at haiper.ai/haiper-api",
  transport: {
    baseUrl: "https://api.haiper.ai/v1",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "gen2",
      name: "Gen 2 Video",
    },
    {
      id: "gen2-image",
      name: "Gen 2 Image",
    },
  ],
};
