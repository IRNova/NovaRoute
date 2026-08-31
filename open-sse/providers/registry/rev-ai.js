export default {
  id: "rev-ai",
  alias: "revai",
  display: {
    name: "Rev AI",
    icon: "subtitles",
    color: "#FF5C35",
    textIcon: "RA",
    website: "https://rev.ai",
    notice: {
      apiKeyUrl: "https://www.rev.ai/account",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: null,
  models: [],
  serviceKinds: ["stt"],
  sttConfig: {
    baseUrl: "https://api.rev.ai/v1/speech-to-text",
    authType: "apikey",
    authHeader: "bearer",
    format: "revai",
  },
};
