export default {
  id: "inference-net",
  alias: "inet",
  hasFree: true,
  display: {
    name: "Inference.net",
    icon: "dns",
    color: "#2563EB",
    textIcon: "IN",
    website: "https://inference.net",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.inference.net/v1/chat/completions",
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
      id: "deepseek-ai/DeepSeek-R1",
      name: "deepseek-ai/DeepSeek-R1",
    },
    {
      id: "Qwen/Qwen2.5-72B-Instruct",
      name: "Qwen/Qwen2.5-72B-Instruct",
    },
  ],
};
