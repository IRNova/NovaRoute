export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "kimi-web",
  alias: "kimi-web",
  display: {
    name: "Kimi Web",
    icon: "auto_awesome",
    color: "#2563EB",
    textIcon: "KW",
    website: "https://www.kimi.com/code?aff=novaroute",
  },
  category: "webCookie",
  authHint: "Paste access_token from www.kimi.com DevTools ? Application ? Local Storage. A legacy kimi-auth cookie is also accepted.",
  cookieHint: "Open DevTools ? Application ? Local Storage ? www.kimi.com ? copy access_token",
  transport: {
    cookieName: "token",
    baseUrl: "https://www.kimi.com",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "k3",
      name: "K3",
      supportsReasoning: true,
    },
    {
      id: "k2d6",
      name: "K2.6",
      supportsReasoning: true,
    },
  ],
  credentialFields: [
    { id: "token", label: "refresh_token / token", required: true, hint: "DevTools > Application > Local Storage > kimi.com > refresh_token (or token)" },
  ],
};
