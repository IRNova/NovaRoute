export default {
  id: "dahl",
  alias: "dahl",
  hasFree: true,
  display: {
    name: "Dahl",
    icon: "dahl",
    color: "#6B7280",
    textIcon: "DA",
    website: "https://inference.dahl.global",
    notice: {
      text: "Dahl auto-generates tokens via https://inference.dahl.global/tokens. No signup needed. Rate limits apply. You can also add your own API key.",
    },
  },
  category: "apikey",
  authHint: "Click 'Add Account' to auto-generate a token, or add a manual API key.",
  transport: {
    baseUrl: "https://inference.dahl.global/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "MiniMaxAI/MiniMax-M2.7",
      name: "MiniMax M2.7",
      contextLength: 200000,
    },
    {
      id: "moonshotai/Kimi-K2.6",
      name: "Kimi K2.6",
      contextLength: 200000,
    },
  ],
};
