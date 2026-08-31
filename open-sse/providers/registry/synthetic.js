export default {
  id: "synthetic",
  alias: "synthetic",
  display: {
    name: "Synthetic",
    icon: "verified_user",
    color: "#6366F1",
    textIcon: "SY",
    website: "https://synthetic.new",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.synthetic.new/openai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.synthetic.new/openai/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "hf:openai/gpt-oss-120b",
      name: "openai/gpt-oss-120b",
      aliases: [
        "syn:gpt-oss-120b",
      ],
      toolCalling: true,
      supportsReasoning: true,
      maxOutputTokens: 65536,
      contextLength: 131072,
    },
    {
      id: "hf:zai-org/GLM-5.2",
      name: "zai-org/GLM-5.2",
      aliases: [
        "syn:large:text",
      ],
      toolCalling: true,
      supportsReasoning: true,
      maxOutputTokens: 65536,
      contextLength: 524288,
    },
    {
      id: "hf:moonshotai/Kimi-K2.7-Code",
      name: "moonshotai/Kimi-K2.7-Code",
      aliases: [
        "syn:large:vision",
      ],
      toolCalling: true,
      supportsReasoning: true,
      supportsVision: true,
      maxOutputTokens: 65536,
      contextLength: 262144,
    },
    {
      id: "hf:Qwen/Qwen3.6-27B",
      name: "Qwen/Qwen3.6-27B",
      aliases: [
        "syn:small:vision",
      ],
      toolCalling: true,
      supportsReasoning: true,
      supportsVision: true,
      maxOutputTokens: 65536,
      contextLength: 262144,
    },
    {
      id: "hf:MiniMaxAI/MiniMax-M3",
      name: "MiniMaxAI/MiniMax-M3",
      aliases: [
        "syn:minimax-m3",
      ],
      toolCalling: true,
      supportsReasoning: true,
      supportsVision: true,
      maxOutputTokens: 65536,
      contextLength: 262144,
    },
    {
      id: "hf:zai-org/GLM-4.7-Flash",
      name: "zai-org/GLM-4.7-Flash",
      aliases: [
        "syn:small:text",
      ],
      toolCalling: true,
      supportsReasoning: true,
      maxOutputTokens: 65536,
      contextLength: 196608,
    },
    {
      id: "hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
      name: "nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4",
      aliases: [
        "syn:nemotron-3-super",
      ],
      toolCalling: true,
      supportsReasoning: true,
      maxOutputTokens: 65536,
      contextLength: 262144,
    },
  ],
  passthroughModels: true,
};
