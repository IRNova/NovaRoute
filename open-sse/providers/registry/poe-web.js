export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "poe-web",
  alias: "poe-web",
  display: {
    name: "Poe Web",
    icon: "chat",
    color: "#6C3AED",
    textIcon: "PW",
    website: "https://poe.com",
  },
  category: "webCookie",
  authHint: "Paste the poe-cookie value from an authenticated poe.com request (DevTools ? Network ? Authorization or cookie header).",
  cookieHint: "Open DevTools ? Network ? any request to poe.com ? copy Authorization header or poe-cookie value",
  transport: {
    credentialHeaders: {"Poe-Formkey":"formkey"},
    cookieName: "p_b",
    baseUrl: "https://poe.com/chat",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [],
  credentialFields: [
    { id: "p_b", label: "p-b cookie", required: true, hint: "DevTools > Application > Cookies > poe.com > p-b (full value)" },
    { id: "formkey", label: "Formkey", required: true, hint: "DevTools > Network > any poe.com request > Poe-Formkey header" },
  ],
};
