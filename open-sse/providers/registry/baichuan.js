export default {
  id: "baichuan",
  alias: "baichuan",
  hasFree: true,
  display: {
    name: "Baichuan",
    icon: "auto_awesome",
    color: "#6366F1",
    textIcon: "BC",
    website: "https://www.baichuan-ai.com/",
  },
  category: "apikey",
  authHint: "Get API key at platform.baichuan-ai.com",
  transport: {
    baseUrl: "https://api.baichuan-ai.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "Baichuan4-Turbo",
      name: "Baichuan 4 Turbo",
      contextLength: 32768,
    },
    {
      id: "Baichuan4-Air",
      name: "Baichuan 4 Air",
      contextLength: 32768,
    },
    {
      id: "Baichuan4",
      name: "Baichuan 4",
    },
    {
      id: "Baichuan3-Turbo",
      name: "Baichuan 3 Turbo",
      contextLength: 32768,
    },
    {
      id: "Baichuan3-Turbo-128k",
      name: "Baichuan 3 Turbo 128k",
      contextLength: 131072,
    },
  ],
  passthroughModels: true,
};
