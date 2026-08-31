export default {
  id: "openference-api",
  alias: "ofa",
  hasFree: true,
  display: {
    name: "Openference API",
    icon: "openference",
    color: "#6366F1",
    textIcon: "OF",
    website: "https://openference.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.openference.com/v1/chat/completions",
    responsesUrl: "https://api.openference.com/v1/responses",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "GLM-5.2",
      name: "GLM 5.2",
      contextLength: 850000,
    },
  ],
  passthroughModels: true,
};
