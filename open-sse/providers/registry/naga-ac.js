export default {
  id: "naga-ac",
  alias: "naga",
  hasFree: true,
  display: {
    deprecated: true,
    deprecationNotice: "Duplicate provider — use \"nagaai\" instead.",
    name: "Naga.ac",
    icon: "bolt",
    color: "#7C3AED",
    textIcon: "NA",
    website: "https://naga.ac",
  },
  category: "apikey",
  authHint: "Get API key at naga.ac — Google/GitHub/Discord signup available.",
  transport: {
    baseUrl: "https://api.naga.ac/v1/chat/completions",
    authType: "optional",
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
