export default {
  id: "ai21",
  alias: "ai21",
  hasFree: true,
  display: {
    name: "AI21 Labs",
    icon: "psychology_alt",
    color: "#0284C7",
    textIcon: "AI21",
    website: "https://www.ai21.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.ai21.com/studio/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "jamba-large-1.7",
      name: "jamba-large-1.7",
    },
    {
      id: "jamba-mini-2",
      name: "jamba-mini-2",
    },
  ],
};
