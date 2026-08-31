export default {
  id: "adapta-web",
  alias: "adp-web",
  display: {
    name: "Adapta.org (Adapta One Web)",
    icon: "auto_awesome",
    color: "#6E3AD3",
    textIcon: "AW",
    website: "https://agent.adapta.one",
  },
  category: "webCookie",
  authHint: "Paste your __client cookie value from .clerk.agent.adapta.one (DevTools → Application → Cookies)",
  cookieHint: "Open DevTools → Application → Cookies → .clerk.agent.adapta.one → copy __client",
  transport: {
    baseUrl: "https://agent.adapta.one/api/chat/stream/v1",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "adapta-one",
      name: "Adapta ONE (Auto)",
      toolCalling: false,
    },
    {
      id: "adapta-gpt",
      name: "GPT-5 (via Adapta)",
      toolCalling: false,
    },
    {
      id: "adapta-claude",
      name: "Claude Sonnet 4.6 (via Adapta)",
      toolCalling: false,
    },
    {
      id: "adapta-gemini",
      name: "Gemini 2.5 Pro (via Adapta)",
      toolCalling: false,
    },
    {
      id: "adapta-grok",
      name: "Grok 4 (via Adapta)",
      toolCalling: false,
    },
    {
      id: "adapta-deepseek",
      name: "DeepSeek R2 (via Adapta)",
      toolCalling: false,
    },
    {
      id: "adapta-llama",
      name: "Llama 4 (via Adapta)",
      toolCalling: false,
    },
  ],
  credentialFields: [
    { id: "token", label: "Client Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Application > Cookies > .clerk.agent.adapta.one > copy __client value" },
  ],
};