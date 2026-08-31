export default {
  id: "llamacpp-local",
  priority: 50,
  hasFree: true,
  alias: "llamacpp-local",
  display: {
    name: "llama.cpp Local",
    icon: "cloud",
    color: "#ffffffff",
    textIcon: "LC",
    website: "https://github.com/ggerganov/llama.cpp",
  },
  category: "local",
  transport: {
    baseUrl: "http://localhost:8080/v1/chat/completions",
    format: "openai",
  },
  serviceKinds: ["llm"],
};
