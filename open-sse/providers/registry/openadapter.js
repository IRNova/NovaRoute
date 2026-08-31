export default {
  id: "openadapter",
  alias: "oad",
  hasFree: true,
  display: {
    name: "OpenAdapter",
    icon: "hub",
    color: "#10B981",
    textIcon: "OD",
    website: "https://openadapter.dev",
  },
  category: "apikey",
  authHint: "Use your OpenAdapter API key in Authorization: Bearer sk-cv-<key>. Fully OpenAI-compatible. API base URL: https://api.openadapter.in/v1.",
  transport: {
    baseUrl: "https://api.openadapter.in/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://api.openadapter.in/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "glm-4.7",
      name: "GLM 4.7 (OpenAdapter)",
      toolCalling: true,
      contextLength: 128000,
    },
  ],
};
