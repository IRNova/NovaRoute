export default {
  id: "llm-kiwi",
  alias: "llmkiwi",
  hasFree: true,
  display: {
    name: "LLM.Kiwi",
    icon: "hub",
    color: "#84CC16",
    textIcon: "LK",
    website: "https://llm.kiwi",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.llm.kiwi/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.llm.kiwi/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "auto",
      name: "Auto",
    },
    {
      id: "hrLLM",
      name: "hrLLM",
    },
  ],
  passthroughModels: true,
};
