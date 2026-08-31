export default {
  id: "kimi-coding-apikey",
  alias: "kmca",
  display: {
    name: "Kimi Code API Key",
    icon: "psychology",
    color: "#1E40AF",
    textIcon: "KC",
    website: "https://www.kimi.com/code?aff=novaroute",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.kimi.com/coding/v1/messages?beta=true",
    format: "claude",
    authType: "apikey",
    auth: {
      header: "x-api-key",
      scheme: "raw",
      combined: true,
    },
    headers: {
      "Anthropic-Version": "2023-06-01",
    },
  },
  models: [
    {
      id: "k3",
      name: "Kimi K3",
      supportsReasoning: true,
      contextLength: 1048576,
    },
    {
      id: "kimi-for-coding",
      name: "Kimi K2.7 Code",
      supportsReasoning: true,
      contextLength: 262144,
    },
    {
      id: "kimi-for-coding-highspeed",
      name: "Kimi K2.7 Code (High Speed)",
      supportsReasoning: true,
      contextLength: 262144,
    },
  ],
};
