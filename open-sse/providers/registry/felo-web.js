export default {
  id: "felo-web",
  alias: "felo",
  hasFree: true,
  display: {
    name: "Felo",
    icon: "travel_explore",
    color: "#5B7FFF",
    textIcon: "FL",
    website: "https://felo.ai",
    notice: {
      text: "Felo uses a reverse-engineered public endpoint (no official API). No signup or API key needed. Behavior may change without notice if Felo updates its frontend.",
    },
  },
  category: "free",
  noAuth: true,
  authHint: "No credentials required — Felo is a free, no-signup chat/search aggregator.",
  transport: {
    baseUrl: "https://felo.ai/api-proxy/main/search/threads",
    authType: "none",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  serviceKinds: [
    "llm",
  ],
  models: [
    {
      id: "felo-chat",
      name: "Felo Chat",
      toolCalling: false,
    },
    {
      id: "felo-search",
      name: "Felo Search",
      toolCalling: false,
    },
    {
      id: "felo-scholar",
      name: "Felo Scholar",
      toolCalling: false,
    },
    {
      id: "felo-social",
      name: "Felo Social",
      toolCalling: false,
    },
    {
      id: "felo-document",
      name: "Felo Document",
      toolCalling: false,
    },
  ],
};
