export default {
  id: "oobabooga",
  alias: "oobabooga",
  display: {
    name: "oobabooga",
    icon: "psychology",
    color: "#8B5CF6",
    textIcon: "OB",
    website: "https://github.com/oobabooga/text-generation-webui",
  },
  category: "local",
  noAuth: true,
  transport: {
    baseUrl: "http://localhost:5000/v1/chat/completions",
  },
  localDefault: "http://localhost:5000/v1",
  models: [],
  passthroughModels: true,
};
