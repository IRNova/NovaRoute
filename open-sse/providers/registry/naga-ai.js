export default {
  id: "naga-ai",
  alias: "naga-ai",
  hasFree: true,
  display: {
    deprecated: true,
    deprecationNotice: "Duplicate provider — use \"nagaai\" instead.",
    name: "Naga AI",
    icon: "router",
    color: "#059669",
    textIcon: "NA",
    website: "https://naga.ac",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.naga.ac/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.naga.ac/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
