export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "hyperagent",
  alias: "ha",
  display: {
    name: "HyperAgent (Unofficial/Experimental)",
    icon: "auto_awesome",
    color: "#6C5CE7",
    textIcon: "HA",
    website: "https://hyperagent.com",
  },
  category: "webCookie",
  authHint: "Paste the full Cookie header from hyperagent.com (DevTools ? Network ? any request ? Request Headers ? Cookie). Session cookies power chat + billing usage.",
  cookieHint: "Open DevTools ? Network ? any request to hyperagent.com ? copy full Cookie header",
  transport: {
    baseUrl: "https://hyperagent.com/api/threads",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "fable-latest",
      name: "Fable 5",
      contextLength: 1000000,
    },
    {
      id: "claude-fable-5",
      name: "Claude Fable 5",
      contextLength: 1000000,
    },
    {
      id: "opus-latest",
      name: "Claude Opus Latest",
      contextLength: 1000000,
    },
    {
      id: "claude-opus-4-8",
      name: "Claude Opus 4.8",
      contextLength: 1000000,
    },
    {
      id: "sonnet-latest",
      name: "Claude Sonnet Latest",
      contextLength: 1000000,
    },
    {
      id: "claude-sonnet-5",
      name: "Claude Sonnet 5",
      contextLength: 1000000,
    },
  ],
  passthroughModels: true,
  credentialFields: [
    { id: "cookie", label: "Full Cookie Header", placeholder: "session=xxx; other=val", type: "textarea", required: true, hint: "Open DevTools > Network > any request to hyperagent.com > copy full Cookie header" },
  ],
};