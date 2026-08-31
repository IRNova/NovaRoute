export default {
  id: "helyxai",
  alias: "helyxai",
  hasFree: true,
  display: {
    name: "Helyx AI",
    icon: "hub",
    color: "#7C3AED",
    textIcon: "HX",
    website: "https://helyxai.space",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://helyxai.space/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://helyxai.space/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
