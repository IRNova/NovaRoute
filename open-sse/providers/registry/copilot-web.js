export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "copilot-web",
  alias: "copilot-web",
  display: {
    name: "Microsoft Copilot Web",
    icon: "auto_awesome",
    color: "#0078D4",
    textIcon: "CP",
    website: "https://copilot.microsoft.com",
  },
  category: "webCookie",
  authHint: "Paste the access_token from an authenticated copilot.microsoft.com request (DevTools ? Network ? Authorization), or export a HAR while logged in",
  cookieHint: "Open DevTools ? Network ? any request to copilot.microsoft.com ? copy Authorization header value",
  transport: {
    cookieName: "_U",
    baseUrl: "wss://copilot.microsoft.com/c/api/chat?api-version=2",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "copilot-pro",
      name: "Copilot Pro (web)",
      toolCalling: false,
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo (via Copilot)",
      toolCalling: false,
    },
    {
      id: "gpt-4",
      name: "GPT-4 (via Copilot)",
      toolCalling: false,
    },
  ],
  credentialFields: [
    { id: "cookie", label: "Full Cookie Header", placeholder: "_U=...; MUID=...", required: true, hint: "Copy the ENTIRE Cookie header from a copilot.microsoft.com request" },
  ],
};
