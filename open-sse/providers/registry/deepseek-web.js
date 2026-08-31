export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "deepseek-web",
  alias: "ds-web",
  display: {
    name: "DeepSeek Web",
    icon: "auto_awesome",
    color: "#4D6BFE",
    textIcon: "DS",
    website: "https://chat.deepseek.com",
  },
  category: "webCookie",
  authHint: "Paste your userToken from chat.deepseek.com ? DevTools ? Application ? Local Storage ? userToken",
  cookieHint: "Open DevTools ? Application ? Local Storage ? chat.deepseek.com ? copy userToken",
  transport: {
    cookieName: "userToken",
    baseUrl: "https://chat.deepseek.com/api/v0/chat/completion",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      toolCalling: true,
    },
    {
      id: "deepseek-v4-pro-think",
      name: "DeepSeek V4 Pro Think",
      toolCalling: true,
      supportsReasoning: true,
    },
    {
      id: "deepseek-v4-pro-search",
      name: "DeepSeek V4 Pro Search",
      toolCalling: true,
    },
    {
      id: "deepseek-v4-pro-think-search",
      name: "DeepSeek V4 Pro Think+Search",
      toolCalling: true,
      supportsReasoning: true,
    },
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      toolCalling: true,
    },
    {
      id: "deepseek-v4-flash-think",
      name: "DeepSeek V4 Flash Think",
      toolCalling: true,
      supportsReasoning: true,
    },
    {
      id: "deepseek-v4-flash-search",
      name: "DeepSeek V4 Flash Search",
      toolCalling: true,
    },
    {
      id: "deepseek-v4-flash-think-search",
      name: "DeepSeek V4 Flash Think+Search",
      toolCalling: true,
      supportsReasoning: true,
    },
    {
      id: "deepseek-chat",
      name: "DeepSeek Chat",
      toolCalling: true,
    },
    {
      id: "deepseek-reasoner",
      name: "DeepSeek Reasoner",
      toolCalling: true,
      supportsReasoning: true,
    },
    {
      id: "DeepSeek-R1",
      name: "DeepSeek R1",
      toolCalling: true,
      supportsReasoning: true,
    },
    {
      id: "DeepSeek-R1-Search",
      name: "DeepSeek R1 Search",
      toolCalling: true,
      supportsReasoning: true,
    },
    {
      id: "DeepSeek-V3.2",
      name: "DeepSeek V3.2",
      toolCalling: true,
    },
    {
      id: "DeepSeek-Search",
      name: "DeepSeek Search",
      toolCalling: true,
    },
  ],
  credentialFields: [
    { id: "userToken", label: "userToken", required: true, hint: "DevTools > Application > Cookies > chat.deepseek.com > userToken" },
  ],
};
