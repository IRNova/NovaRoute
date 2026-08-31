export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "microsoft-designer-web",
  alias: "msdesigner",
  display: {
    name: "Microsoft Designer",
    icon: "palette",
    color: "#0078D4",
    textIcon: "MD",
    website: "https://designer.microsoft.com",
  },
  category: "webCookie",
  authHint: "Paste the access_token from an authenticated designer.microsoft.com request (DevTools ? Network ? Authorization).",
  cookieHint: "Open DevTools ? Network ? any request to designer.microsoft.com ? copy Authorization header value",
  transport: {
    baseUrl: "https://designer.microsoft.com/api/chat",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [],
  credentialFields: [
    { id: "token", label: "Access Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Network > any request to designer.microsoft.com > copy Authorization header value" },
  ],
};