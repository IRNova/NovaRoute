export default {
  id: "g4f-nvidia",
  alias: "g4fnv",
  hasFree: true,
  display: {
    name: "g4f.space — NVIDIA",
    icon: "bolt",
    color: "#F97316",
    textIcon: "G4F",
    website: "https://g4f.space",
  },
  category: "apikey",
  authHint: "No auth required. Free tier is limited to 5 requests/minute — sign up at g4f.dev/members.html for higher limits.",
  transport: {
    baseUrl: "https://g4f.space/api/nvidia/v1/chat/completions",
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://g4f.space/api/nvidia/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "nvidia/nemotron-3-nano-30b-a3b",
      name: "Nemotron 3 Nano 30B (g4f/NVIDIA)",
    },
    {
      id: "z-ai/glm-5.2",
      name: "GLM 5.2 (g4f/NVIDIA)",
    },
    {
      id: "minimaxai/minimax-m2.7",
      name: "MiniMax M2.7 (g4f/NVIDIA)",
    },
  ],
  passthroughModels: true,
};
