export default {
  id: "publicai",
  alias: "publicai",
  display: {
    name: "PublicAI",
    icon: "public",
    color: "#059669",
    textIcon: "PA",
    website: "https://publicai.co",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.publicai.co/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "swiss-ai/apertus-70b-instruct",
      name: "swiss-ai/apertus-70b-instruct",
    },
    {
      id: "swiss-ai/Apertus-8B-Instruct-2509",
      name: "swiss-ai/Apertus-8B-Instruct-2509",
    },
    {
      id: "aisingapore/Qwen-SEA-LION-v4-32B-IT",
      name: "aisingapore/Qwen-SEA-LION-v4-32B-IT",
    },
    {
      id: "aisingapore/Gemma-SEA-LION-v4-27B-IT",
      name: "aisingapore/Gemma-SEA-LION-v4-27B-IT",
    },
    {
      id: "allenai/Olmo-3-32B-Think",
      name: "allenai/Olmo-3-32B-Think",
    },
    {
      id: "allenai/Olmo-3-7B-Instruct",
      name: "allenai/Olmo-3-7B-Instruct",
    },
    {
      id: "utter-project/EuroLLM-22B-Instruct-2512",
      name: "utter-project/EuroLLM-22B-Instruct-2512",
    },
  ],
};
