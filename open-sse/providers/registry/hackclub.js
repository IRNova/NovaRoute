export default {
  id: "hackclub",
  alias: "hc",
  hasFree: true,
  display: {
    name: "Hackclub AI",
    icon: "auto_awesome",
    color: "#FF6B00",
    textIcon: "HC",
    website: "https://ai.hackclub.com",
  },
  category: "apikey",
  authHint: "Sign in with your Hack Club account at ai.hackclub.com.",
  transport: {
    baseUrl: "https://ai.hackclub.com/proxy/v1/chat/completions",
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://ai.hackclub.com/proxy/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "meta-llama/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B",
      contextLength: 128000,
    },
    {
      id: "mistralai/mistral-7b-instruct",
      name: "Mistral 7B",
      contextLength: 128000,
    },
    {
      id: "deepseek-ai/deepseek-coder-33b",
      name: "DeepSeek Coder 33B",
      contextLength: 128000,
    },
  ],
  passthroughModels: true,
};
