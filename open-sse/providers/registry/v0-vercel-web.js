export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "v0-vercel-web",
  alias: "v0web",
  display: {
    name: "v0 Vercel Web",
    icon: "code_blocks",
    color: "#000000",
    textIcon: "VW",
    website: "https://v0.dev",
  },
  category: "webCookie",
  authHint: "Paste the access token from an authenticated v0.dev request (DevTools ? Network ? Authorization).",
  cookieHint: "Open DevTools ? Network ? any request to v0.dev ? copy Authorization header value",
  transport: {
    baseUrl: "https://v0.dev/chat",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [],
  credentialFields: [
    { id: "token", label: "Access Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Network > any request to v0.dev > copy Authorization header value" },
  ],
};