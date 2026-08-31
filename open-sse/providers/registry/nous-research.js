export default {
  id: "nous-research",
  alias: "nous",
  hasFree: true,
  display: {
    name: "Nous Research",
    icon: "hub",
    color: "#2563EB",
    textIcon: "NO",
    website: "https://portal.nousresearch.com/help",
  },
  category: "apikey",
  authHint: "Use your Nous Portal API key. Nova Route targets the official OpenAI-compatible inference endpoint at https://inference-api.nousresearch.com/v1.",
  transport: {
    baseUrl: "https://inference-api.nousresearch.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "Hermes-4-405B",
      name: "Hermes 4 7B (Nous Research)",
    },
    {
      id: "Hermes-4-70B",
      name: "Hermes 4 70B (Nous Research)",
    },
  ],
};
