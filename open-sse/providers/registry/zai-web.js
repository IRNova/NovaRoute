export default {
  id: "zai-web",
  alias: "zw",
  hasFree: true,
  display: {
    name: "Z.ai Web",
    icon: "auto_awesome",
    color: "#2563EB",
    textIcon: "ZW",
    website: "https://chat.z.ai",
  },
  category: "webCookie",
  authHint: "Paste the token value from chat.z.ai Local Storage. Chat itself may be gated by a Z.ai slide-captcha (their upstream policy) - token and the live model list still verify correctly.",
  cookieHint: "Open DevTools → Application → Local Storage → chat.z.ai → copy token value",
  transport: {
    // Full chat-completions path required: DefaultExecutor POSTs to this URL
    // verbatim, and validate's /models probe derives from it. A bare origin
    // here made validation hit the SPA (200 HTML → false "valid") while every
    // real request 404'd.
    baseUrl: "https://chat.z.ai/api/v2/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "glm-5.2",
      name: "GLM-5.2",
      toolCalling: false,
      supportsReasoning: true,
    },
    {
      id: "GLM-5.1",
      name: "GLM-5.1",
      toolCalling: false,
      supportsReasoning: true,
    },
    {
      id: "GLM-5-Turbo",
      name: "GLM-5-Turbo",
      toolCalling: false,
      supportsReasoning: true,
    },
    {
      id: "GLM-5v-Turbo",
      name: "GLM-5V-Turbo",
      toolCalling: false,
      supportsReasoning: true,
      supportsVision: true,
    },
  ],
  credentialFields: [
    { id: "token", label: "Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Application > Local Storage > chat.z.ai > copy token value" },
  ],
};