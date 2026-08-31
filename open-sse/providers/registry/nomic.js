export default {
  id: "nomic",
  alias: "nomic",
  display: {
    name: "Nomic AI",
    icon: "data_object",
    color: "#10B981",
    textIcon: "NM",
    website: "https://www.nomic.ai",
    notice: {
      apiKeyUrl: "https://atlas.nomic.ai/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: null,
  models: [
    { id: "nomic-embed-text-v1", name: "Nomic Embed Text V1", kind: "embedding" },
    { id: "nomic-embed-text-v1.5", name: "Nomic Embed Text V1.5", kind: "embedding" },
    { id: "nomic-embed-v2-moe-300m", name: "Nomic Embed V2 MoE 300M", kind: "embedding" },
  ],
  serviceKinds: ["embedding"],
  embeddingConfig: { baseUrl: "https://api-atlas.nomic.ai/v1/embeddings" },
};
