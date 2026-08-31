export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "adobe-firefly",
  alias: "firefly",
  display: {
    name: "Adobe Firefly",
    icon: "local_fire_department",
    color: "#EB1000",
    textIcon: "AF",
    website: "https://firefly.adobe.com",
  },
  category: "webCookie",
  authHint: "Paste the access token from an authenticated firefly.adobe.com request (DevTools ? Network ? Authorization).",
  cookieHint: "Open DevTools ? Network ? any request to firefly.adobe.com ? copy Authorization header value",
  transport: {
    baseUrl: "https://firefly.adobe.com/api/chat",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [],
  credentialFields: [
    { id: "token", label: "Access Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Network > any request to firefly.adobe.com > copy Authorization header value" },
  ],
};