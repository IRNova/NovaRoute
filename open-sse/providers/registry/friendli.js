export default {
  id: "friendli",
  alias: "friendli",
  display: {
    name: "FriendliAI",
    icon: "cloud_queue",
    color: "#F97316",
    textIcon: "FRND",
    website: "https://friendli.ai",
  },
  category: "apikey",
  hasFree: true,
  transport: {
    baseUrl: "https://api.friendli.ai/serverless/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "zai-org/GLM-5.2", name: "GLM-5.2" },
    { id: "deepseek-ai/DeepSeek-V3.2", name: "DeepSeek V3.2" },
    { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct" },
    { id: "Qwen/Qwen3-235B-A22B", name: "Qwen3 235B" },
    { id: "MiniMaxAI/MiniMax-M2.5", name: "MiniMax M2.5" },
  ],
  passthroughModels: true,
};
