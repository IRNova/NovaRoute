export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "copilot-m365-web",
  alias: "m365copilot",
  display: {
    name: "Microsoft 365 Copilot (BizChat)",
    icon: "business_center",
    color: "#0078D4",
    textIcon: "M365",
    website: "https://m365.cloud.microsoft/chat",
  },
  category: "webCookie",
  authHint: "Sign in at m365.cloud.microsoft/chat, then open DevTools ? Network ? filter 'WS' ? click the Chathub WebSocket connection. Copy both the access_token query parameter AND the account-specific Chathub path segment from its request URL (wss://?/Chathub/<path>??&access_token=?). It is NOT an Authorization: Bearer header on an XHR/Fetch request. The token is short-lived; this is an unofficial integration.",
  cookieHint: "Open DevTools ? Network ? WS ? Chathub connection ? copy access_token from request URL",
  transport: {
    baseUrl: "wss://substrate.office.com/m365Copilot/Chathub",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "copilot-m365",
      name: "Microsoft 365 Copilot (BizChat)",
      toolCalling: false,
    },
    {
      id: "copilot-m365-claude-opus",
      name: "Microsoft 365 Copilot ? Claude Opus",
      toolCalling: false,
    },
    {
      id: "copilot-m365-gpt-5-6-reasoning",
      name: "Microsoft 365 Copilot ? GPT 5.6 Reasoning",
      toolCalling: false,
    },
    {
      id: "copilot-m365-gpt-5-5-chat",
      name: "Microsoft 365 Copilot ? GPT 5.5 Chat",
      toolCalling: false,
    },
  ],
  credentialFields: [
    { id: "token", label: "Access Token", placeholder: "eyJhbGciOi...", type: "text", required: true, hint: "Open DevTools > Network > WS > Chathub connection > copy access_token from request URL query params" },
  ],
};