export default {
  id: "bytez",
  alias: "bytez",
  hasFree: true,
  display: {
    name: "Bytez",
    icon: "api",
    color: "#6366F1",
    textIcon: "BZ",
    website: "https://bytez.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.bytez.com/models/v2/openai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "meta-llama/Llama-3.3-70B-Instruct",
      name: "meta-llama/Llama-3.3-70B-Instruct",
    },
    {
      id: "mistralai/Mistral-7B-Instruct-v0.3",
      name: "mistralai/Mistral-7B-Instruct-v0.3",
    },
    {
      id: "Qwen/Qwen2.5-72B-Instruct",
      name: "Qwen/Qwen2.5-72B-Instruct",
    },
  ],
};
