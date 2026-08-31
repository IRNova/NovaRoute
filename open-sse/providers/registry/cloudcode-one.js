export default {
  id: "cloudcode-one",
  alias: "cloudcode-one",
  hasFree: true,
  display: {
    name: "CloudCode.ONE",
    icon: "router",
    color: "#6366F1",
    textIcon: "CC",
    website: "https://cloudcode.one",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.cloudcode.one/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.cloudcode.one/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "glm-4.7-flash",
      name: "GLM 4.7 Flash",
    },
    {
      id: "glm-4.6v-flash",
      name: "GLM 4.6V Flash",
    },
  ],
  passthroughModels: true,
};
