export default {
  id: "writer",
  alias: "writer",
  display: {
    name: "Writer",
    icon: "auto_awesome",
    color: "#111827",
    textIcon: "WR",
    website: "https://dev.writer.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.writer.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "palmyra-x5",
      name: "Palmyra X5",
      contextLength: 1048576,
    },
    {
      id: "palmyra-x4",
      name: "Palmyra X4",
      contextLength: 131072,
    },
  ],
};
