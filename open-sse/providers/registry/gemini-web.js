export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "gemini-web",
  alias: "gweb",
  display: {
    name: "Gemini Web (Free)",
    icon: "auto_awesome",
    color: "#4285F4",
    textIcon: "GWeb",
    website: "https://gemini.google.com",
  },
  category: "webCookie",
  authHint: "Paste your __Secure-1PSID cookie value from gemini.google.com. Optionally add __Secure-1PSIDTS separated by semicolon.",
  cookieHint: "Open DevTools ? Application ? Cookies ? gemini.google.com ? copy __Secure-1PSID",
  transport: {
    baseUrl: "https://gemini.google.com/app",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "gemini-3.1-pro",
      name: "Gemini 3.1 Pro",
      toolCalling: false,
      supportsReasoning: false,
    },
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
      toolCalling: false,
      supportsReasoning: false,
    },
    {
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash-Lite",
      toolCalling: false,
      supportsReasoning: false,
    },
  ],
  credentialFields: [
    { id: "psid", label: "__Secure-1PSID", placeholder: "cookie value...", type: "text", required: true, hint: "Open DevTools > Application > Cookies > gemini.google.com > copy __Secure-1PSID value" },
    { id: "psidts", label: "__Secure-1PSIDTS (optional)", placeholder: "optional cookie value...", type: "text", required: false, hint: "If available, also copy __Secure-1PSIDTS for longer session life" },
  ],
};