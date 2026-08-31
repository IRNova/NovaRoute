export default {
  id: "llama-cpp",
  alias: "llamacpp",
  display: {
    name: "llama.cpp",
    icon: "terminal",
    color: "#795548",
    textIcon: "LC",
    website: "https://github.com/ggerganov/llama.cpp",
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
