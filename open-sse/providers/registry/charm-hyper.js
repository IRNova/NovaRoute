export default {
  id: "charm-hyper",
  alias: "charm-hyper",
  hasFree: true,
  display: {
    name: "Charm Hyper",
    icon: "router",
    color: "#7C3AED",
    textIcon: "CH",
    website: "https://hyper.charm.land",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://hyper.charm.land/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://hyper.charm.land/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "hyper/auto",
      name: "Charm Hyper Auto",
    },
  ],
  passthroughModels: true,
};
