export default {
  id: "uncloseai",
  alias: "unc",
  hasFree: true,
  display: {
    name: "UncloseAI",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "UN",
    website: "https://uncloseai.com",
  },
  category: "apikey",
  authHint: "No auth required. API accepts any non-empty string as key for identification. If older built-in models return 404, use Available Models → Import from /models or Auto-Sync; verified live model: solidrust/Hermes-3-Llama-3.1-8B-AWQ.",
  transport: {
    baseUrl: "https://hermes.ai.unturf.com/v1/chat/completions",
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "adamo1139/Hermes-3-Llama-3.1-8B-FP8-Dynamic",
      name: "Hermes 3 Llama 3.1 8B (🆓 Free)",
    },
    {
      id: "qwen3.6:27b",
      name: "Qwen3 Coder 27B (🆓 Free)",
    },
    {
      id: "gemma4:31b",
      name: "Gemma 4 31B (🆓 Free)",
    },
  ],
  passthroughModels: true,
};
