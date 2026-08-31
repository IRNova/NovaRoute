export default {
  id: "mixedbread",
  alias: "mixedbread",
  display: {
    name: "Mixedbread AI",
    icon: "grain",
    color: "#7C3AED",
    textIcon: "MB",
    website: "https://www.mixedbread.ai",
    notice: {
      apiKeyUrl: "https://www.mixedbread.ai/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: null,
  models: [
    { id: "mxbai-embed-large-v1", name: "mxbai-embed-large-v1", kind: "embedding" },
    { id: "mxbai-embed-v1", name: "mxbai-embed-v1", kind: "embedding" },
  ],
  serviceKinds: ["embedding"],
  embeddingConfig: { baseUrl: "https://api.mixedbread.ai/v1/embeddings" },
};
