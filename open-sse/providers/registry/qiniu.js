export default {
  id: "qiniu",
  alias: "qiniu",
  display: {
    name: "Qiniu",
    icon: "cloud",
    color: "#1E88E5",
    textIcon: "QN",
    website: "https://www.qiniu.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.qnaigc.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.qnaigc.com/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
