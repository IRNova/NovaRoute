export default {
  id: "gladia",
  alias: "gladia",
  display: {
    name: "Gladia",
    icon: "hearing",
    color: "#6425FE",
    textIcon: "GL",
    website: "https://gladia.io",
    notice: {
      apiKeyUrl: "https://gladia.io/dashboard/settings",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: null,
  models: [],
  serviceKinds: ["stt"],
  sttConfig: {
    baseUrl: "https://api.gladia.io/v2/transcription",
    authType: "apikey",
    authHeader: "x-gladia-key",
    format: "gladia",
  },
};
