export default {
  id: "dgrid",
  alias: "dgrid",
  hasFree: true,
  display: {
    name: "DGrid",
    icon: "router",
    color: "#65A30D",
    textIcon: "DG",
    website: "https://dgrid.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.dgrid.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.dgrid.ai/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "dgridai/free",
      name: "DGrid Free Models Router",
      contextLength: 128000,
    },
  ],
  passthroughModels: true,
};
