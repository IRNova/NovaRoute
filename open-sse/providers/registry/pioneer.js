export default {
  id: "pioneer",
  alias: "pn",
  hasFree: true,
  display: {
    name: "Pioneer AI",
    icon: "rocket_launch",
    color: "#7C5CFF",
    textIcon: "PN",
    website: "https://pioneer.ai",
    notice: {
      text: "Pioneer AI by Fastino Labs. Free $75 usage credits, no credit card required. Use API key auth with a pio_sk_... key. Only open-tier models (Qwen3, Llama, Gemma, SmolLM) work directly — gated models (Claude/GPT/Gemini) require prior fine-tuning via the Pioneer platform.",
      apiKeyUrl: "https://agent.pioneer.ai/settings/api-keys",
      signupUrl: "https://agent.pioneer.ai/auth",
    },
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.pioneer.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "x-api-key",
      scheme: "raw",
      combined: true,
    },
  },
  serviceKinds: [
    "llm",
  ],
  models: [
    {
      id: "Qwen/Qwen3-32B",
      name: "Qwen3 32B",
    },
    {
      id: "Qwen/Qwen3.6-27B",
      name: "Qwen3.6 27B",
    },
    {
      id: "Qwen/Qwen3.5-9B",
      name: "Qwen3.5 9B",
    },
    {
      id: "Qwen/Qwen3-8B",
      name: "Qwen3 8B",
    },
    {
      id: "Qwen/Qwen3-4B-Base",
      name: "Qwen3 4B Base",
    },
    {
      id: "Qwen/Qwen3-1.7B-Base",
      name: "Qwen3 1.7B Base",
    },
    {
      id: "meta-llama/Llama-3.1-8B-Instruct",
      name: "Llama 3.1 8B Instruct",
    },
    {
      id: "meta-llama/Llama-3.2-1B-Instruct",
      name: "Llama 3.2 1B Instruct",
    },
    {
      id: "google/gemma-3-4b-pt",
      name: "Gemma 3 4B (Pretrained)",
    },
    {
      id: "HuggingFaceTB/SmolLM3-3B-Base",
      name: "SmolLM3 3B Base",
    },
  ],
};
