export default {
  id: "modelscope",
  alias: "ms",
  hasFree: true,
  display: {
    name: "ModelScope",
    icon: "cloud",
    color: "#FF6A00",
    textIcon: "MS",
    website: "https://modelscope.cn",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api-inference.modelscope.cn/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api-inference.modelscope.cn/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
