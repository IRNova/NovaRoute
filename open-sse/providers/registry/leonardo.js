export default {
  id: "leonardo",
  alias: "leo",
  display: {
    name: "Leonardo AI",
    icon: "palette",
    color: "#8B5CF6",
    textIcon: "LE",
    website: "https://leonardo.ai",
  },
  category: "apikey",
  authHint: "Get API key at leonardo.ai/developer",
  transport: {
    baseUrl: "https://cloud.leonardo.ai/api/rest/v1",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "phoenix",
      name: "Phoenix",
    },
    {
      id: "sdxl",
      name: "SDXL",
    },
  ],
};
