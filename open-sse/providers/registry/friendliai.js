export default {
  id: "friendliai",
  alias: "friendliai",
  hasFree: true,
  display: {
    name: "FriendliAI",
    icon: "handshake",
    color: "#EC4899",
    textIcon: "FR",
    website: "https://friendli.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.friendli.ai/serverless/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.friendli.ai/serverless/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "meta-llama-3.1-70b-instruct",
      name: "meta-llama-3.1-70b-instruct",
    },
    {
      id: "meta-llama-3.1-8b-instruct",
      name: "meta-llama-3.1-8b-instruct",
    },
  ],
};
