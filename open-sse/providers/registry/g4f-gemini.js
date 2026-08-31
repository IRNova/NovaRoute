export default {
  id: "g4f-gemini",
  alias: "g4fgem",
  hasFree: true,
  display: {
    name: "g4f.space — Gemini",
    icon: "bolt",
    color: "#F97316",
    textIcon: "G4F",
    website: "https://g4f.space",
  },
  category: "apikey",
  authHint: "No auth required. Free tier is limited to 5 requests/minute — sign up at g4f.dev/members.html for higher limits.",
  transport: {
    baseUrl: "https://g4f.space/api/gemini/v1/chat/completions",
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://g4f.space/api/gemini/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "models/gemini-2.5-flash",
      name: "Gemini 2.5 Flash (g4f)",
    },
    {
      id: "models/gemini-2.5-pro",
      name: "Gemini 2.5 Pro (g4f)",
    },
  ],
  passthroughModels: true,
};
