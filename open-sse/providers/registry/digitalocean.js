export default {
  id: "digitalocean",
  alias: "digitalocean",
  display: {
    name: "DigitalOcean",
    icon: "cloud",
    color: "#0060FF",
    textIcon: "DO",
    website: "https://docs.digitalocean.com/products/ai-platform/",
    notice: {
      text: "Use a DigitalOcean Personal Access Token (dop_v1_...) or a Model Access Key from the Inference console. OAuth tokens (doo_v1_...) may not have the required scopes.",
      apiKeyUrl: "https://cloud.digitalocean.com/account/api/tokens",
    },
  },
  category: "apikey",
  transport: {
    baseUrl: "https://inference.do-ai.run/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://inference.do-ai.run/v1/models",
      type: "openai",
    },
  },
  serviceKinds: [
    "llm",
  ],
  models: [],
  passthroughModels: true,
};
