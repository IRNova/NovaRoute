export default {
  id: "g4f-ollama",
  alias: "g4foll",
  hasFree: true,
  display: {
    name: "g4f.space — Ollama",
    icon: "bolt",
    color: "#F97316",
    textIcon: "G4F",
    website: "https://g4f.space",
  },
  category: "apikey",
  authHint: "No auth required. Free tier is limited to 5 requests/minute — sign up at g4f.dev/members.html for higher limits.",
  transport: {
    baseUrl: "https://g4f.space/api/ollama/v1/chat/completions",
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://g4f.space/api/ollama/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "gemma3:4b",
      name: "Gemma 3 4B (g4f/Ollama)",
    },
  ],
  passthroughModels: true,
};
