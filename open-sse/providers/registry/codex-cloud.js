export default {
  id: "codex-cloud",
  alias: "codex-cloud",
  display: {
    name: "Codex Cloud",
    icon: "code",
    color: "#10A37F",
    textIcon: "CC",
    website: "https://openai.com/index/introducing-codex/",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
  },
  models: [],
  passthroughModels: true,
};
