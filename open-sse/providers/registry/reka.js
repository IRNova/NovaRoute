export default {
  id: "reka",
  alias: "reka",
  hasFree: true,
  display: {
    name: "Reka",
    icon: "auto_awesome",
    color: "#111827",
    textIcon: "RK",
    website: "https://docs.reka.ai/chat/overview",
  },
  category: "apikey",
  authHint: "Use your Reka API key. Nova Route supports the OpenAI-compatible base URL https://api.reka.ai/v1 and sends both Authorization and X-Api-Key headers for compatibility.",
  transport: {
    baseUrl: "https://api.reka.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "reka-flash-3",
      name: "Reka Flash 3",
    },
    {
      id: "reka-flash",
      name: "Reka Flash",
    },
    {
      id: "reka-edge-2603",
      name: "Reka Edge 2603",
    },
  ],
};
