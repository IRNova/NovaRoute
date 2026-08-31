export default {
  id: "triton",
  alias: "triton",
  display: {
    name: "NVIDIA Triton",
    icon: "memory",
    color: "#76B900",
    textIcon: "TR",
    website: "https://github.com/triton-inference-server",
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
