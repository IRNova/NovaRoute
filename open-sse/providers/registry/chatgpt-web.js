export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "chatgpt-web",
  alias: "cgpt-web",
  display: {
    name: "ChatGPT Web (Plus/Pro)",
    icon: "auto_awesome",
    color: "#10A37F",
    textIcon: "CG",
    website: "https://chatgpt.com",
  },
  category: "webCookie",
  authHint: "Paste your __Secure-next-auth.session-token cookie value from chatgpt.com",
  cookieHint: "Open DevTools ? Application ? Cookies ? chatgpt.com ? copy __Secure-next-auth.session-token",
  transport: {
    cookieName: "__Secure-next-auth.session-token",
    baseUrl: "https://chatgpt.com/backend-api/conversation",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "gpt-5.6-pro",
      name: "GPT-5.6 Pro",
      toolCalling: false,
    },
    {
      id: "gpt-5.6-thinking",
      name: "GPT-5.6 Thinking",
      toolCalling: false,
    },
    {
      id: "gpt-5.5-pro-extended",
      name: "GPT-5.5 Pro Extended",
      toolCalling: false,
    },
    {
      id: "gpt-5.5-pro",
      name: "GPT-5.5 Pro",
      toolCalling: false,
    },
    {
      id: "gpt-5.5-thinking",
      name: "GPT-5.5 Thinking",
      toolCalling: false,
    },
    {
      id: "gpt-5.5",
      name: "GPT-5.5 Instant",
      toolCalling: false,
    },
    {
      id: "o3",
      name: "o3",
      toolCalling: false,
    },
  ],
  credentialFields: [
    { id: "__Secure-next-auth.session-token", label: "Session Token", placeholder: "eyJhbGciOi...", required: true, hint: "DevTools > Application > Cookies > chatgpt.com > __Secure-next-auth.session-token" },
    { id: "cf_clearance", label: "cf_clearance (optional)", required: false, hint: "Cloudflare clearance cookie, if challenged" },
  ],
};
