export default {
  id: "g4f-groq",
  alias: "g4fgroq",
  hasFree: true,
  display: {
    name: "g4f.space — Groq",
    icon: "bolt",
    color: "#F97316",
    textIcon: "G4F",
    website: "https://g4f.space",
  },
  category: "apikey",
  authHint: "No auth required. Free tier is limited to 5 requests/minute — sign up at g4f.dev/members.html for higher limits.",
  transport: {
    baseUrl: "https://g4f.space/api/groq/v1/chat/completions",
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://g4f.space/api/groq/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B (g4f/Groq)",
    },
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B Instant (g4f/Groq)",
    },
  ],
  passthroughModels: true,
};
