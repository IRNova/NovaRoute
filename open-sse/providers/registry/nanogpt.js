export default {
  id: "nanogpt",
  alias: "nanogpt",
  display: {
    name: "NanoGPT",
    icon: "chat",
    color: "#4F46E5",
    textIcon: "NG",
    website: "https://nano-gpt.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://nano-gpt.com/api/v1/chat/completions",
    responsesUrl: "https://nano-gpt.com/api/v1/responses",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://nano-gpt.com/api/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "chatgpt-4o-latest",
      name: "chatgpt-4o-latest",
    },
    {
      id: "claude-3.5-sonnet",
      name: "claude-3.5-sonnet",
    },
    {
      id: "gpt-4o-mini",
      name: "gpt-4o-mini",
    },
  ],
};
