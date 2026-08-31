export default {
  id: "mistral",
  priority: 80,
  alias: "mistral",
  display: {
    name: "Mistral",
    icon: "air",
    color: "#FF7000",
    textIcon: "MI",
    website: "https://mistral.ai",
    notice: {
      apiKeyUrl: "https://console.mistral.ai/api-keys",
    },
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    validateUrl: "https://api.mistral.ai/v1/models",
    quirks: {
      dropClientMetadata: true,
    },
  },
  models: [
    { id: "mistral-large-latest", name: "Mistral Large 3", contextWindow: 128000 },
    { id: "codestral-latest", name: "Codestral", contextWindow: 256000 },
    { id: "mistral-medium-latest", name: "Mistral Medium 3", contextWindow: 32000 },
    { id: "mistral-embed", name: "Mistral Embed", kind: "embedding", contextWindow: 32000 },
  ],
  serviceKinds: ["llm","imageToText","embedding"],
  embeddingConfig: { baseUrl: "https://api.mistral.ai/v1/embeddings", authType: "apikey", authHeader: "bearer" },
};
