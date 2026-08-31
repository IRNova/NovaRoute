export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "claude-web",
  alias: "cw",
  display: {
    name: "Claude Web",
    icon: "auto_awesome",
    color: "#D97757",
    textIcon: "CW",
    website: "https://claude.ai",
  },
  category: "webCookie",
  authHint: "Paste your session cookie from claude.ai",
  cookieHint: "Open DevTools ? Application ? Cookies ? claude.ai ? copy sessionKey",
  transport: {
    baseUrl: "https://claude.ai/api/organizations",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "claude-fable-5",
      name: "Claude Fable 5 (web)",
      toolCalling: false,
    },
    {
      id: "claude-opus-5",
      name: "Claude Opus 5 (web)",
      toolCalling: false,
      supportsReasoning: true,
      supportsVision: true,
      maxOutputTokens: 128000,
      contextLength: 1000000,
    },
    {
      id: "claude-opus-4-8",
      name: "Claude Opus 4.8 (web)",
      toolCalling: false,
    },
    {
      id: "claude-opus-4-7",
      name: "Claude Opus 4.7 (web)",
      toolCalling: false,
    },
    {
      id: "claude-opus-4-6",
      name: "Claude Opus 4.6 (web)",
      toolCalling: false,
    },
    {
      id: "claude-sonnet-5",
      name: "Claude Sonnet 5 (web)",
      toolCalling: false,
    },
    {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6 (web)",
      toolCalling: false,
    },
    {
      id: "claude-haiku-4-5-20251001",
      name: "Claude Haiku 4.5 (web)",
      toolCalling: false,
    },
  ],
  credentialFields: [
    { id: "sessionKey", label: "Session Key", placeholder: "sk-ant-sid01-...", required: true, hint: "DevTools > Application > Cookies > claude.ai > sessionKey" },
    { id: "lastActiveOrg", label: "Organization ID", placeholder: "b0b6f5aa-5011-...", required: true, hint: "claude.ai Settings > ORGANIZATION ID" },
  ],
};
