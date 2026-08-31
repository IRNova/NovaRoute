export default {
  id: "regolo",
  alias: "regolo",
  display: {
    name: "Regolo AI",
    icon: "hub",
    color: "#6366F1",
    textIcon: "RG",
    website: "https://regolo.ai",
  },
  category: "apikey",
  authHint: "Get your Regolo API key from regolo.ai, then paste it here as a Bearer token.",
  transport: {
    baseUrl: "https://api.regolo.ai",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "regolo-chat",
      name: "Regolo Chat",
    },
    {
      id: "regolo-fast",
      name: "Regolo Fast",
    },
  ],
  passthroughModels: true,
};
