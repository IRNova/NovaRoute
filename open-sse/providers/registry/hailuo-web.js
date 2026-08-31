export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "hailuo-web",
  alias: "hailuo-web",
  display: {
    name: "Hailuo Web (MiniMax)",
    icon: "auto_awesome",
    color: "#5B21B6",
    textIcon: "HL",
    website: "https://hailuo.ai",
  },
  category: "webCookie",
  authHint: "Open hailuo.ai, log in, then open DevTools ? Application ? Local Storage ? copy the \"_token\" value. device_id/uuid fingerprint fields are derived automatically; if requests fail, re-capture _token (sessions can expire).",
  cookieHint: "Open DevTools ? Application ? Local Storage ? hailuo.ai ? copy _token",
  transport: {
    baseUrl: "https://www.hailuo.ai",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "hailuo",
      name: "Hailuo (MiniMax)",
    },
  ],
  credentialFields: [
    { id: "token", label: "Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Application > Local Storage > hailuo.ai > copy _token value" },
  ],
};