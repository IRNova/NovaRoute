export default {
  id: "nube",
  alias: "nube",
  display: {
    name: "Nube.sh",
    icon: "cloud",
    color: "#2563EB",
    textIcon: "NB",
    website: "https://nube.sh",
    notice: {
      text: "OpenAI-compatible gateway (LiteLLM). Bring your own API key — models are resolved live from the account (passthrough).",
      apiKeyUrl: "https://nube.sh/dashboard/api-keys",
    },
  },
  category: "apikey",
  transport: {
    baseUrl: "https://ai.nube.sh/api/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://ai.nube.sh/api/v1/models",
      type: "openai",
    },
  },
  models: [],
  passthroughModels: true,
};
