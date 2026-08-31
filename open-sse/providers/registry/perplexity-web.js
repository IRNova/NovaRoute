export default {
  id: "perplexity-web",
  priority: 220,
  alias: "perplexity-web",
  aliases: [
    "pw",
  ],
  uiAlias: "pw",
  display: {
    name: "Perplexity Web (Pro/Max)",
    icon: "search",
    color: "#20808D",
    textIcon: "PW",
    website: "https://www.perplexity.ai",
  },
  category: "webCookie",
  authType: "cookie",
  authHint: "Paste your __Secure-next-auth.session-token cookie value from perplexity.ai",
  cookieHint: "Open DevTools → Application → Cookies → perplexity.ai → copy __Secure-next-auth.session-token",
  transport: {
    cookieName: "__Secure-next-auth.session-token",
    baseUrl: "https://www.perplexity.ai/rest/sse/perplexity_ask",
    format: "perplexity-web",
    authType: "cookie",
  },
  models: [
    { id: "pplx-auto", name: "Perplexity Auto (Free)" },
    { id: "pplx-sonar", name: "Perplexity Sonar" },
    { id: "pplx-gpt", name: "GPT-5.4 (via Perplexity)" },
    { id: "pplx-gemini", name: "Gemini 3.1 Pro (via Perplexity)" },
    { id: "pplx-sonnet", name: "Claude Sonnet 4.6 (via Perplexity)" },
    { id: "pplx-opus", name: "Claude Opus 4.6 (via Perplexity)" },
    { id: "pplx-nemotron", name: "Nemotron 3 Super (via Perplexity)" },
  ],
  credentialFields: [
    { id: "__Secure-next-auth.session-token", label: "Session Token", placeholder: "eyJhbGciOi...", required: true, hint: "DevTools > Application > Cookies > perplexity.ai > __Secure-next-auth.session-token" },
    { id: "cf_clearance", label: "cf_clearance (optional)", required: false, hint: "Cloudflare clearance cookie, if challenged" },
  ],
};
