export default {
  id: "nlpcloud",
  alias: "nlpcloud",
  display: {
    name: "NLP Cloud",
    icon: "cloud_queue",
    color: "#0D9488",
    textIcon: "NLPC",
    website: "https://nlpcloud.com",
  },
  category: "apikey",
  hasFree: true,
  transport: {
    baseUrl: "https://api.nlpcloud.io/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "Token",
      combined: true,
    },
  },
  models: [
    { id: "llama-3-1-405b", name: "Llama 3.1 405B" },
    { id: "gpt-oss-120b", name: "GPT-OSS 120B" },
    { id: "finetuned-llama-3-70b", name: "Finetuned Llama 3 70B" },
    { id: "chatdolphin", name: "ChatDolphin" },
    { id: "whisper", name: "Whisper" },
  ],
  passthroughModels: true,
};
