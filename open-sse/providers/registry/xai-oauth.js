export default {
  id: "xai-oauth",
  alias: "xao",
  // Duplicate of the canonical card / no connect handler yet - hidden from UI
  display: {
    name: "xAI OAuth (Grok)",
    icon: "auto_awesome",
    color: "#1DA1F2",
    textIcon: "XA",
    website: "https://x.ai",
  },
  category: "oauth",
  authHint: "Sign in with xAI to use api.x.ai models such as Grok 4.5. This is separate from Grok Build JWT sessions, which use cli-chat-proxy.grok.com and grok-build model aliases.",
  transport: {
    baseUrl: "https://api.x.ai/v1/chat/completions",
    responsesUrl: "https://api.x.ai/v1/responses",
    authType: "oauth",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  oauth: {
    tokenUrl: "https://auth.x.ai/oauth2/token",
    clientId: "b1a00492-073a-47ea-816f-4c329264a828",
  },
  models: [
    {
      id: "grok-4.5",
      name: "Grok 4.5",
      targetFormat: "openai-responses",
      contextLength: 500000,
    },
    {
      id: "grok-4.3",
      name: "Grok 4.3",
    },
    {
      id: "grok-build-0.1",
      name: "Grok Build 0.1",
      contextLength: 256000,
    },
    {
      id: "grok-4.20-multi-agent-0309",
      name: "Grok 4.20 Multi Agent",
      targetFormat: "openai-responses",
    },
    {
      id: "grok-4.20-0309-reasoning",
      name: "Grok 4.20 Reasoning",
    },
    {
      id: "grok-4.20-0309-non-reasoning",
      name: "Grok 4.20",
    },
  ],
  passthroughModels: true,
};
