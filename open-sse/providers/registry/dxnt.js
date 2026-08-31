export default {
  id: "dxnt",
  alias: "dxnt",
  hasFree: true,
  display: {
    name: "DXNT / DX Token",
    icon: "hub",
    color: "#111827",
    textIcon: "DX",
    website: "https://www.dxnt.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://www.dxnt.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://www.dxnt.com/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
