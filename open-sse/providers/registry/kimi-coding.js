export default {
  id: "kimi-coding",
  alias: "kmc",
  // Duplicate of the canonical card / no connect handler yet - hidden from UI
  display: {
    name: "Kimi Code CLI",
    icon: "psychology",
    color: "#1E40AF",
    textIcon: "KC",
    website: "https://www.kimi.com/code?aff=novaroute",
  },
  category: "oauth",
  authHint: "Sign in with the same Kimi account used by Kimi Code CLI. Nova Route uses the CLI OAuth flow and Kimi Coding Plan endpoints.",
  transport: {
    baseUrl: "https://api.kimi.com/coding/v1/messages?beta=true",
    format: "claude",
    authType: "oauth",
    auth: {
      header: "x-api-key",
      scheme: "raw",
      combined: true,
    },
    headers: {
      "Anthropic-Version": "2023-06-01",
    },
  },
  oauth: {
    tokenUrl: "https://auth.kimi.com/api/oauth/token",
    refreshUrl: "https://auth.kimi.com/api/oauth/token",
    clientId: "17e5f671-d194-4dfb-9706-5516cb48c098",
    authorizeUrl: "https://auth.kimi.com/api/oauth/device_authorization",
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
