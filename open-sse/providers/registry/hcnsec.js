export default {
  id: "hcnsec",
  alias: "hcnsec",
  hasFree: true,
  display: {
    name: "Huancheng Public API",
    icon: "security",
    color: "#0EA5E9",
    textIcon: "HC",
    website: "https://api.hcnsec.cn",
  },
  category: "apikey",
  authHint: "Get API key at api.hcnsec.cn",
  transport: {
    baseUrl: "https://api.hcnsec.cn/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.hcnsec.cn/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
