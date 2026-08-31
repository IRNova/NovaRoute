export default {
  id: "codestral",
  alias: "codestral",
  display: {
    name: "Codestral",
    icon: "terminal",
    color: "#FF7000",
    textIcon: "CS",
    website: "https://mistral.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://codestral.mistral.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "codestral-2508",
      name: "codestral-2508",
    },
    {
      id: "codestral-latest",
      name: "codestral-latest",
    },
  ],
};
