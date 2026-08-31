export default {
  id: "hetzner",
  alias: "hetzner",
  aliases: [
    "hetzner-inference",
  ],
  uiAlias: "hetzner",
  display: {
    name: "Hetzner Inference",
    icon: "cloud",
    color: "#D50C2D",
    textIcon: "HZ",
    website: "https://www.hetzner.com/cloud",
    notice: {
      apiKeyUrl: "https://console.hetzner.com/ai",
      note: "Experimental — generous free limits while in beta",
    },
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey",
  ],
  transport: {
    baseUrl: "https://inference.hetzner.com/api/v1/chat/completions",
    validateUrl: "https://inference.hetzner.com/api/v1/models",
  },
  models: [
    { id: "qwen3-35b-a3b", name: "Qwen3 35B A3B (Hetzner)", contextLength: 128000 },
  ],
  passthroughModels: true,
};
