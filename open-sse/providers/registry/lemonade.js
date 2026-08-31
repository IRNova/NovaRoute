export default {
  id: "lemonade",
  alias: "lemonade",
  display: {
    name: "Lemonade Server",
    icon: "citrus",
    color: "#F59E0B",
    textIcon: "LM",
    website: "https://docs.lemonade-ai.com",
  },
  category: "local",
  noAuth: true,
  transport: {
    baseUrl: "http://localhost:13305/api/v1/chat/completions",
  },
  localDefault: "http://localhost:13305/api/v1",
  models: [],
  passthroughModels: true,
};
