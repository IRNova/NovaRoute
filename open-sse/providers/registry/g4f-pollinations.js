export default {
  id: "g4f-pollinations",
  alias: "g4fpol",
  hasFree: true,
  display: {
    name: "g4f.space — Pollinations",
    icon: "bolt",
    color: "#F97316",
    textIcon: "G4F",
    website: "https://g4f.space",
  },
  category: "apikey",
  authHint: "No auth required. Free tier is limited to 5 requests/minute — sign up at g4f.dev/members.html for higher limits.",
  transport: {
    baseUrl: "https://g4f.space/api/pollinations/v1/chat/completions",
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://g4f.space/api/pollinations/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "openai",
      name: "OpenAI (g4f/Pollinations)",
    },
    {
      id: "openai-fast",
      name: "OpenAI Fast (g4f/Pollinations)",
    },
  ],
  passthroughModels: true,
};
