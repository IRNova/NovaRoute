export default {
  id: "xinference",
  alias: "xinference",
  display: {
    name: "XInference",
    icon: "science",
    color: "#DC2626",
    textIcon: "XI",
    website: "https://inference.readthedocs.io",
  },
  category: "local",
  noAuth: true,
  transport: {
    baseUrl: "http://localhost:9997/v1/chat/completions",
  },
  localDefault: "http://localhost:9997/v1",
  models: [],
  passthroughModels: true,
};
