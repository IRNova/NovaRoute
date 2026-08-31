export default {
  id: "blackbox-web",
  alias: "bb-web",
  display: {
    name: "Blackbox Web (Subscription)",
    icon: "view_in_ar",
    color: "#1A1A2E",
    textIcon: "BW",
    website: "https://app.blackbox.ai",
  },
  category: "webCookie",
  authHint: "Paste your __Secure-authjs.session-token value or full cookie header from app.blackbox.ai",
  cookieHint: "Open DevTools → Application → Cookies → app.blackbox.ai → copy __Secure-authjs.session-token",
  transport: {
    cookieName: "session",
    baseUrl: "https://app.blackbox.ai/api/chat",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      toolCalling: false,
    },
    {
      id: "gpt-4",
      name: "GPT-4",
      toolCalling: false,
    },
    {
      id: "gpt-3.5-turbo",
      name: "GPT-3.5 Turbo",
      toolCalling: false,
    },
    {
      id: "claude-3-opus",
      name: "Claude 3 Opus",
      toolCalling: false,
    },
    {
      id: "claude-3-sonnet",
      name: "Claude 3 Sonnet",
      toolCalling: false,
    },
    {
      id: "gemini-pro",
      name: "Gemini Pro",
      toolCalling: false,
    },
  ],
  credentialFields: [
    { id: "token", label: "Session Token", required: true, hint: "DevTools > Application > Cookies > app.blackbox.ai (session cookie value)" },
  ],
};