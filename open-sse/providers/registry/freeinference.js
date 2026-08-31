export default {
  id: "freeinference",
  alias: "freeinference",
  hasFree: true,
  display: {
    name: "FreeInference",
    icon: "science",
    color: "#8B5CF6",
    textIcon: "FI",
    website: "https://freeinference.org",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://freeinference.org/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://freeinference.org/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
