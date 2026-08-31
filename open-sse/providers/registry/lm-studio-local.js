export default {
  noAuth: true,
  id: "lm-studio-local",
  priority: 50,
  hasFree: true,
  alias: "lm-studio-local",
  display: {
    name: "LM Studio Local",
    icon: "cloud",
    color: "#ffffffff",
    textIcon: "LS",
    website: "https://lmstudio.ai",
  },
  category: "local",
  transport: {
    baseUrl: "http://localhost:1234/v1/chat/completions",
    format: "openai",
  },
  serviceKinds: ["llm"],
};
