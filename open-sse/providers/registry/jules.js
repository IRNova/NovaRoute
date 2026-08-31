export default {
  id: "jules",
  alias: "jules",
  display: {
    name: "Google Jules",
    icon: "robot",
    color: "#4285F4",
    textIcon: "JL",
    website: "https://jules.google.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://jules.google.com/api/v1/chat/completions",
  },
  models: [],
  passthroughModels: true,
};
