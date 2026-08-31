export default {
  id: "duckduckgo-web",
  alias: "ddgw",
  hasFree: true,
  display: {
    name: "DuckDuckGo AI Chat",
    icon: "auto_awesome",
    color: "#DE5833",
    textIcon: "DDG",
    website: "https://duckduckgo.com/duckchat",
  },
  category: "free",
  noAuth: true,
  authHint: "No credentials required — DuckDuckGo AI Chat is anonymous and free.",
  transport: {
    baseUrl: "https://duckduckgo.com/duckchat/v1/chat",
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
      id: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
      toolCalling: false,
    },
    {
      id: "gpt-5.4-nano",
      name: "GPT-5.4 Nano",
      toolCalling: false,
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude Haiku 4.5",
      toolCalling: false,
    },
    {
      id: "mistral-small-2603",
      name: "Mistral Small 4",
      toolCalling: false,
    },
    {
      id: "tinfoil/gpt-oss-120b",
      name: "gpt-oss 120B",
      toolCalling: false,
    },
    {
      id: "tinfoil/gemma4-31b",
      name: "Gemma 4 31B",
      toolCalling: false,
    },
  ],
};
