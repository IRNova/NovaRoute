export default {
  id: "chipotle",
  alias: "pepper",
  hasFree: true,
  display: {
    name: "Chipotle Pepper AI (Free)",
    icon: "restaurant",
    color: "#C41230",
    textIcon: "🌯",
    website: "https://amelia.chipotle.com",
  },
  category: "free",
  noAuth: true,
  authHint: "No credentials required. Uses Chipotle's public support chatbot via reverse-engineered SockJS/STOMP protocol.",
  transport: {
    baseUrl: "https://amelia.chipotle.com",
    baseUrls: [
      "https://amelia.chipotle.com",
    ],
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
      id: "pepper-1",
      name: "Pepper (Chipotle AI 🌯)",
    },
  ],
  passthroughModels: true,
};
