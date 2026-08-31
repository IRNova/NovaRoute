export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "notion-web",
  alias: "nw",
  display: {
    name: "Notion AI Web (Unofficial/Experimental)",
    icon: "auto_awesome",
    color: "#000000",
    textIcon: "NW",
    website: "https://www.notion.so",
  },
  category: "webCookie",
  authHint: "Paste only the token_v2 cookie VALUE from app.notion.com (DevTools ? Application ? Cookies ? token_v2). Do not paste token_v2= or the full Cookie header. Workspace is auto-detected; space_id / notion_user_id are optional.",
  cookieHint: "Open DevTools ? Application ? Cookies ? app.notion.com ? copy token_v2 value only",
  transport: {
    baseUrl: "https://app.notion.com/api/v3/runInferenceTranscript",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "notion-ai",
      name: "Notion AI (default)",
    },
    {
      id: "gpt-5.6-sol",
      name: "GPT-5.6 Sol",
    },
    {
      id: "gpt-5.6-terra",
      name: "GPT-5.6 Terra",
    },
    {
      id: "gpt-5.6-luna",
      name: "GPT-5.6 Luna",
    },
    {
      id: "gpt-5.2",
      name: "GPT-5.2",
    },
    {
      id: "gpt-5.4",
      name: "GPT-5.4",
    },
    {
      id: "gpt-5.5",
      name: "GPT-5.5",
    },
    {
      id: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
    },
    {
      id: "gpt-5.4-nano",
      name: "GPT-5.4 Nano",
    },
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
    },
    {
      id: "gemini-3-flash",
      name: "Gemini 3 Flash",
    },
    {
      id: "gemini-3.1-pro",
      name: "Gemini 3.1 Pro",
    },
    {
      id: "sonnet-4.6",
      name: "Sonnet 4.6",
    },
    {
      id: "sonnet-5",
      name: "Sonnet 5",
    },
    {
      id: "opus-4.6",
      name: "Opus 4.6",
    },
    {
      id: "opus-4.7",
      name: "Opus 4.7",
    },
    {
      id: "opus-4.8",
      name: "Opus 4.8",
    },
    {
      id: "haiku-4.5",
      name: "Haiku 4.5",
    },
    {
      id: "fable-5",
      name: "Fable 5",
    },
    {
      id: "kimi-k2.6",
      name: "Kimi K2.6",
    },
    {
      id: "kimi-k2.7-code",
      name: "Kimi K2.7 Code",
    },
    {
      id: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
    },
    {
      id: "glm-5.2",
      name: "GLM 5.2",
    },
    {
      id: "grok-4.3",
      name: "Grok 4.3",
    },
    {
      id: "grok-4.5",
      name: "Grok 4.5",
    },
    {
      id: "grok-build-0.1",
      name: "Grok Build 0.1",
    },
  ],
  passthroughModels: true,
  credentialFields: [
    { id: "token", label: "Token V2", placeholder: "token_v2 value...", type: "text", required: true, hint: "Open DevTools > Application > Cookies > app.notion.com > copy token_v2 value only" },
  ],
};