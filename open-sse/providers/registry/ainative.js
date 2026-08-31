export default {
  id: "ainative",
  hasFree: true,
  display: {
    name: "AINative Studio",
    icon: "hub",
    color: "#7C3AED",
    textIcon: "AN",
    website: "https://ainative.studio",
  },
  category: "apikey",
  authHint: "Create a free API key at ainative.studio (no card), then paste it here as a Bearer token.",
  transport: {
    baseUrl: "https://api.ainative.studio/api/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.ainative.studio/api/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "qwen3-235b-cerebras",
      name: "Qwen3 235B (Cerebras)",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "qwen3-32b",
      name: "Qwen3 32B",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "qwen3-14b",
      name: "Qwen3 14B",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "qwen3-8b",
      name: "Qwen3 8B",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "llama-4-maverick",
      name: "Llama 4 Maverick",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "llama3.1-8b-cerebras",
      name: "Llama 3.1 8B (Cerebras)",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "deepseek-r1",
      name: "DeepSeek R1",
      supportsReasoning: true,
      contextLength: 65536,
    },
    {
      id: "nous-coder",
      name: "Nous Coder",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "gemini-flash",
      name: "Gemini Flash",
      toolCalling: true,
      contextLength: 131072,
    },
  ],
  passthroughModels: true,
};
