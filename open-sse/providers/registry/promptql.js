export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "promptql",
  alias: "pql",
  display: {
    name: "PromptQL (Unofficial/Experimental)",
    icon: "auto_awesome",
    color: "#5B21B6",
    textIcon: "PQL",
    website: "https://prompt.ql.app",
  },
  category: "webCookie",
  authHint: "Paste the Bearer JWT from prompt.ql.app DevTools ? Network ? graphql ? Authorization (token only). Optional projectId + session Cookie for refresh.",
  cookieHint: "Open DevTools ? Network ? graphql request ? copy Authorization header (JWT token only)",
  transport: {
    baseUrl: "https://data.prompt.ql.app/promptql/playground-v2-hge/v1/graphql",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "vertex-claude-fable-5",
      name: "Claude Fable 5",
    },
    {
      id: "bedrock-claude-opus-4-8",
      name: "Claude Opus 4.8",
    },
    {
      id: "bedrock-claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
    },
    {
      id: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
    },
    {
      id: "gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro Preview",
    },
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
    },
    {
      id: "glm-5.2",
      name: "GLM 5.2",
    },
    {
      id: "gpt-5.5",
      name: "GPT 5.5",
    },
    {
      id: "gpt-5.6-luna",
      name: "GPT-5.6 Luna",
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
      id: "xai-grok-4-5",
      name: "Grok 4.5",
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
      id: "minimax-m3",
      name: "Minimax M3",
      supportsVision: true,
    },
  ],
  passthroughModels: true,
  credentialFields: [
    { id: "token", label: "JWT Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Network > graphql request > copy Authorization header value" },
    { id: "projectId", label: "Project ID (optional)", placeholder: "", type: "text", required: false, hint: "Optional: for session refresh, copy projectId from the GraphQL request payload" },
  ],
};