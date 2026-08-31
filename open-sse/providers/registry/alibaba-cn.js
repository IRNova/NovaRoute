export default {
  id: "alibaba-cn",
  alias: "ali-cn",
  display: {
    name: "Alibaba (China)",
    icon: "cloud_queue",
    color: "#FF6600",
    textIcon: "AL",
    website: "https://dashscope.console.aliyun.com/",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "qwen3.7-max",
      name: "Qwen3.7 Max",
    },
    {
      id: "qwen3.7-plus",
      name: "Qwen3.7 Plus",
    },
    {
      id: "qwen3.6-plus",
      name: "Qwen3.6 Plus",
    },
    {
      id: "qwen3.6-27b",
      name: "Qwen3.6 27B",
    },
    {
      id: "qwen3.6-35b-a3b",
      name: "Qwen3.6 35B A3B",
    },
    {
      id: "qwen3.5-plus",
      name: "Qwen3.5 Plus",
    },
    {
      id: "qwen3.5-122b-a10b",
      name: "Qwen3.5 122B A10B",
    },
    {
      id: "qwen3.5-397b-a17b",
      name: "Qwen3.5 397B A17B",
    },
    {
      id: "glm-5.2",
      name: "GLM 5.2",
    },
    {
      id: "glm-5.2-fast-preview",
      name: "GLM 5.2 Fast Preview",
    },
    {
      id: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
    },
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
    },
    {
      id: "kimi-k2.7-code",
      name: "Kimi K2.7 Code",
    },
  ],
  passthroughModels: true,
};
