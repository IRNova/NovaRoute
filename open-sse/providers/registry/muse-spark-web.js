export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "muse-spark-web",
  alias: "ms-web",
  hasFree: true,
  display: {
    name: "Muse Spark Web (Meta AI)",
    icon: "auto_awesome",
    color: "#0866FF",
    textIcon: "MS",
    website: "https://www.meta.ai",
  },
  category: "webCookie",
  authHint: "Paste your ecto_1_sess cookie AND the ecto1:... WS auth token from meta.ai. Capture the ecto1: token in DevTools ? Network ? WS ? the clippy request's Authorization query param. Example: ecto_1_sess=4240a308...NVDg0; ecto1:ABCD...",
  cookieHint: "Open DevTools ? Application ? Cookies ? meta.ai ? copy ecto_1_sess + ecto1: token from WS request",
  transport: {
    baseUrl: "https://www.meta.ai/api/graphql",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "muse-spark",
      name: "Muse Spark",
      toolCalling: false,
    },
    {
      id: "muse-spark-thinking",
      name: "Muse Spark Thinking",
      supportsReasoning: true,
    },
    {
      id: "muse-spark-contemplating",
      name: "Muse Spark Contemplating",
      supportsReasoning: true,
    },
  ],
  credentialFields: [
    { id: "sessionCookie", label: "Session Cookie (ecto_1_sess)", placeholder: "4240a308...NVDg0", type: "text", required: true, hint: "Open DevTools > Application > Cookies > meta.ai > copy ecto_1_sess value" },
    { id: "wsToken", label: "WebSocket Auth Token", placeholder: "ecto1:ABCD...", type: "text", required: true, hint: "Open DevTools > Network > WS > clippy request > copy ecto1:... from Authorization query param" },
  ],
};