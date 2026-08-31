export default {
  id: "freemodel-dev",
  alias: "fmd",
  hasFree: true,
  display: {
    name: "FreeModel.dev",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "FM",
    website: "https://freemodel.dev",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.freemodel.dev/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.freemodel.dev/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "gpt-5.5",
      name: "GPT-5.5",
      contextLength: 400000,
    },
    {
      id: "gpt-5.4",
      name: "GPT-5.4",
      contextLength: 400000,
    },
    {
      id: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
      contextLength: 128000,
    },
    {
      id: "gpt-5.3-codex",
      name: "GPT-5.3 Codex",
      contextLength: 128000,
    },
  ],
};
