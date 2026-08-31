export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "doubao-web",
  alias: "db",
  display: {
    name: "Dola Web (ByteDance)",
    icon: "auto_awesome",
    color: "#3B82F6",
    textIcon: "DA",
    website: "https://www.dola.com",
  },
  category: "webCookie",
  authHint: "Paste the full Cookie header from www.dola.com. It should include sessionid, ttwid, and s_v_web_id. If s_v_web_id is unavailable, fp=verify_... from a chat/completion request URL can be used as a fallback.",
  cookieHint: "Open DevTools ? Network ? any request to www.dola.com ? copy full Cookie header (must include sessionid, ttwid)",
  transport: {
    baseUrl: "https://www.dola.com/chat/completion",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "dola-speed",
      name: "Dola Speed",
      toolCalling: false,
    },
    {
      id: "dola-pro",
      name: "Dola Pro",
      toolCalling: false,
    },
  ],
  credentialFields: [
    { id: "cookie", label: "Full Cookie Header", placeholder: "sessionid=xxx; ttwid=xxx; s_v_web_id=xxx", type: "textarea", required: true, hint: "Open DevTools > Network > any request to www.dola.com > copy full Cookie header" },
  ],
};