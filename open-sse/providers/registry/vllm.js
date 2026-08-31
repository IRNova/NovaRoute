export default {
  id: "vllm",
  alias: "vllm",
  display: {
    name: "vLLM",
    icon: "speed",
    color: "#0F766E",
    textIcon: "vL",
    website: "https://docs.vllm.ai",
  },
  category: "local",
  noAuth: true,
  transport: {
    baseUrl: "http://localhost:8000/v1/chat/completions",
  },
  localDefault: "http://localhost:8000/v1",
  models: [],
  passthroughModels: true,
};
