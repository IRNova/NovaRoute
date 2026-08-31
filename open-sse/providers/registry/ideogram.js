export default {
  id: "ideogram",
  alias: "ideo",
  display: {
    name: "Ideogram",
    icon: "image",
    color: "#EC4899",
    textIcon: "ID",
    website: "https://ideogram.ai",
  },
  category: "apikey",
  authHint: "Get API key at ideogram.ai/docs/api",
  transport: {
    baseUrl: "https://api.ideogram.ai",
    authType: "apikey",
    auth: {
      header: "x-api-key",
      scheme: "raw",
      combined: true,
    },
  },
  models: [
    {
      id: "V_3",
      name: "Ideogram V3",
    },
    {
      id: "V_2A",
      name: "Ideogram V2A",
    },
  ],
};
