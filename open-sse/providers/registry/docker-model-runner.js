export default {
  id: "docker-model-runner",
  alias: "docker-model-runner",
  display: {
    name: "Docker Model Runner",
    icon: "view_in_ar",
    color: "#2496ED",
    textIcon: "DM",
    website: "https://docs.docker.com/model-runner/",
  },
  category: "local",
  noAuth: true,
  transport: {
    baseUrl: "http://localhost:12434/v1/chat/completions",
  },
  localDefault: "http://localhost:12434/v1",
  models: [],
  passthroughModels: true,
};
