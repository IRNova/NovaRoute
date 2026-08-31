export default {
  id: "tokenreply",
  alias: "tokenreply",
  hasFree: true,
  display: {
    name: "TokenReply",
    icon: "router",
    color: "#3B82F6",
    textIcon: "TR",
    website: "https://www.tokenreply.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.tokenreply.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.tokenreply.com/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
