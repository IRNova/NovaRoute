export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "yuanbao-web",
  alias: "ybw",
  hasFree: true,
  display: {
    name: "Tencent Yuanbao (Free)",
    icon: "auto_awesome",
    color: "#0052D9",
    textIcon: "YB",
    website: "https://yuanbao.tencent.com",
  },
  category: "webCookie",
  authHint: "Log in to yuanbao.tencent.com, then paste the full Cookie header (DevTools ? Network ? any /api request ? Request Headers ? Cookie). It must contain hy_user and hy_token.",
  cookieHint: "Open DevTools ? Network ? any /api request ? copy full Cookie header (must include hy_user + hy_token)",
  transport: {
    baseUrl: "https://yuanbao.tencent.com/api/chat",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "deepseek-v3",
      name: "DeepSeek V3 (via Yuanbao)",
      toolCalling: false,
    },
    {
      id: "deepseek-r1",
      name: "DeepSeek R1 (via Yuanbao)",
      supportsReasoning: true,
    },
    {
      id: "hunyuan",
      name: "Hunyuan (via Yuanbao)",
      toolCalling: false,
    },
    {
      id: "hunyuan-t1",
      name: "Hunyuan T1 (via Yuanbao)",
      supportsReasoning: true,
    },
    {
      id: "deepseek-v3-search",
      name: "DeepSeek V3 + Web Search (via Yuanbao)",
      toolCalling: false,
    },
    {
      id: "deepseek-r1-search",
      name: "DeepSeek R1 + Web Search (via Yuanbao)",
      supportsReasoning: true,
    },
    {
      id: "hunyuan-search",
      name: "Hunyuan + Web Search (via Yuanbao)",
      toolCalling: false,
    },
    {
      id: "hunyuan-t1-search",
      name: "Hunyuan T1 + Web Search (via Yuanbao)",
      supportsReasoning: true,
    },
  ],
  credentialFields: [
    { id: "cookie", label: "Full Cookie Header", placeholder: "hy_user=xxx; hy_token=xxx", type: "textarea", required: true, hint: "Open DevTools > Network > any /api request > copy full Cookie header" },
  ],
};