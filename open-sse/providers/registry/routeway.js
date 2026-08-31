export default {
  id: "routeway",
  hasFree: true,
  display: {
    name: "Routeway",
    icon: "hub",
    color: "#F59E0B",
    textIcon: "RW",
    website: "https://routeway.ai",
  },
  category: "apikey",
  authHint: "Create a free API key at routeway.ai, then paste it here as a Bearer token.",
  transport: {
    baseUrl: "https://api.routeway.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.routeway.ai/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "llama-3.3-70b-instruct:free",
      name: "Llama 3.3 70B Instruct (free)",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "nemotron-3-nano-30b-a3b:free",
      name: "Nemotron 3 Nano 30B (free)",
      toolCalling: true,
      contextLength: 256000,
    },
    {
      id: "nemotron-nano-9b-v2:free",
      name: "Nemotron Nano 9B v2 (free)",
      toolCalling: true,
      contextLength: 128000,
    },
    {
      id: "step-3.7-flash:free",
      name: "Step 3.7 Flash (free)",
      toolCalling: true,
      supportsVision: true,
      contextLength: 256000,
    },
    {
      id: "step-3.5-flash:free",
      name: "Step 3.5 Flash (free)",
      toolCalling: true,
      contextLength: 65536,
    },
    {
      id: "laguna-m.1:free",
      name: "Laguna M.1 (free)",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "laguna-xs.2:free",
      name: "Laguna XS.2 (free)",
      toolCalling: true,
      contextLength: 131072,
    },
    {
      id: "llama-3.2-3b-instruct:free",
      name: "Llama 3.2 3B Instruct (free)",
      toolCalling: true,
      contextLength: 16000,
    },
  ],
  passthroughModels: true,
};
