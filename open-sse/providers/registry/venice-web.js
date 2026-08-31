export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "venice-web",
  alias: "vweb",
  display: {
    name: "Venice Web",
    icon: "shield",
    color: "#22C55E",
    textIcon: "VW",
    website: "https://venice.ai",
  },
  category: "webCookie",
  authHint: "Paste the access token from an authenticated venice.ai request (DevTools ? Network ? Authorization).",
  cookieHint: "Open DevTools ? Network ? any request to venice.ai ? copy Authorization header value",
  transport: {
    baseUrl: "https://venice.ai/chat",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [],
  credentialFields: [
    { id: "token", label: "Venice Bearer Token", required: true, hint: "DevTools > Application > Local Storage > venice.ai > token" },
  ],
};
