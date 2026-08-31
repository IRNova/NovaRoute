export default {
  id: "aihorde",
  hasFree: true,
  display: {
    name: "AI Horde",
    icon: "diversity_3",
    color: "#8B5CF6",
    textIcon: "AH",
    website: "https://aihorde.net",
    notice: {
      text: "AI Horde routes to volunteer-run workers, so responses can take minutes and tool calling is unavailable. Model availability changes as workers come and go.",
    },
  },
  category: "free",
  noAuth: true,
  authHint: "No API key required — uses AI Horde's documented anonymous key. Adding a free aihorde.net key is optional and only buys higher queue priority (kudos).",
  transport: {
    baseUrl: "https://oai.aihorde.net/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    timeoutMs: 120000,
    requiresPlainStringContent: true,
    modelsFetcher: {
      url: "https://oai.aihorde.net/v1/models",
      type: "openai",
    },
  },
  serviceKinds: [
    "llm",
  ],
  models: [
    {
      id: "aphrodite/TheDrummer/Cydonia-24B-v4.3",
      name: "Cydonia 24B (AI Horde)",
      toolCalling: false,
      unsupportedParams: [
        "tools",
        "tool_choice",
        "parallel_tool_calls",
      ],
      contextLength: 32768,
    },
    {
      id: "aphrodite/TheDrummer/Skyfall-31B-v4.2",
      name: "Skyfall 31B (AI Horde)",
      toolCalling: false,
      unsupportedParams: [
        "tools",
        "tool_choice",
        "parallel_tool_calls",
      ],
      contextLength: 32768,
    },
    {
      id: "google/gemma-4-31b",
      name: "Gemma 4 31B (AI Horde)",
      toolCalling: false,
      unsupportedParams: [
        "tools",
        "tool_choice",
        "parallel_tool_calls",
      ],
      contextLength: 32768,
    },
  ],
  passthroughModels: true,
};
