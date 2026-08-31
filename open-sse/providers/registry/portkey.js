export default {
  id: "portkey",
  alias: "portkey",
  display: {
    name: "Portkey",
    icon: "cloud_queue",
    color: "#3B82F6",
    textIcon: "PTRK",
    website: "https://portkey.ai",
  },
  category: "apikey",
  hasFree: true,
  transport: {
    baseUrl: "https://api.portkey.ai/chat/completions",
    authType: "apikey",
    auth: {
      header: "x-portkey-api-key",
      combined: true,
    },
  },
  models: [
    { id: "@openai/gpt-4o", name: "GPT-4o" },
    { id: "@anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
    { id: "@google/gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "@mistral-ai/mixtral-8x22b", name: "Mixtral 8x22B" },
    { id: "@meta-llama/llama-3.3-70b", name: "Llama 3.3 70B" },
  ],
  passthroughModels: true,
};
