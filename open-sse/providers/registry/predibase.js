export default {
  id: "predibase",
  alias: "predibase",
  display: {
    name: "Predibase",
    icon: "deployed_code_history",
    color: "#0F766E",
    textIcon: "PB",
    website: "https://predibase.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://serving.app.predibase.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "llama-3.3-70b",
      name: "llama-3.3-70b",
    },
  ],
};
