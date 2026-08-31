export default {
  id: "llamafile",
  alias: "llamafile",
  display: {
    name: "Llamafile",
    icon: "laptop_mac",
    color: "#EA580C",
    textIcon: "LF",
    website: "https://github.com/Mozilla-Ocho/llamafile",
  },
  category: "local",
  noAuth: true,
  transport: {
    baseUrl: "http://127.0.0.1:8080/v1/chat/completions",
  },
  localDefault: "http://127.0.0.1:8080/v1",
  models: [],
  passthroughModels: true,
};
