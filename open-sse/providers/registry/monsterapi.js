export default {
  id: "monsterapi",
  alias: "monster",
  hasFree: true,
  display: {
    name: "MonsterAPI",
    icon: "cloud",
    color: "#EF4444",
    textIcon: "MA",
    website: "https://monsterapi.ai",
  },
  category: "apikey",
  authHint: "Get API key at monsterapi.ai",
  transport: {
    baseUrl: "https://api.monsterapi.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "meta-llama/Meta-Llama-3.1-8B-Instruct",
      name: "Llama 3.1 8B Instruct",
    },
    {
      id: "meta-llama/Llama-3.3-70B-Instruct",
      name: "Llama 3.3 70B Instruct",
    },
  ],
  passthroughModels: true,
};
