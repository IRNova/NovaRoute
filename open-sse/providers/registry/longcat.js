export default {
  id: "longcat",
  alias: "lc",
  hasFree: true,
  display: {
    name: "LongCat AI",
    icon: "auto_awesome",
    color: "#FF6B9D",
    textIcon: "LC",
    website: "https://longcat.chat/platform/docs",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.longcat.chat/openai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "LongCat-2.0",
      name: "LongCat 2.0 (10M tok free 🆓)",
      contextLength: 1048576,
    },
  ],
};
