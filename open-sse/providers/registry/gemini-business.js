export default {
  id: "gemini-business",
  alias: "gbiz",
  hasFree: true,
  display: {
    name: "Gemini Business",
    icon: "auto_awesome",
    color: "#4285F4",
    textIcon: "GB",
    website: "https://gemini.google.com",
  },
  category: "webCookie",
  authHint: "Paste your __Secure-1PSID cookie value from gemini.google.com. Optionally add __Secure-1PSIDTS separated by semicolon.",
  cookieHint: "Open DevTools → Application → Cookies → gemini.google.com → copy __Secure-1PSID",
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
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      toolCalling: false,
      supportsReasoning: true,
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      toolCalling: false,
      supportsReasoning: true,
    },
  ],
  credentialFields: [
    { id: "psid", label: "__Secure-1PSID", placeholder: "cookie value...", type: "text", required: true, hint: "Open DevTools > Application > Cookies > gemini.google.com > copy __Secure-1PSID value" },
    { id: "psidts", label: "__Secure-1PSIDTS (optional)", placeholder: "optional cookie value...", type: "text", required: false, hint: "If available, also copy __Secure-1PSIDTS for longer session life" },
  ],
};