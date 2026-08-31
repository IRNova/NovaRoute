export default {
  id: "soniox",
  alias: "soniox",
  display: {
    name: "Soniox",
    icon: "graphic_eq",
    color: "#5B5BD6",
    textIcon: "SX",
    website: "https://soniox.com",
    notice: {
      apiKeyUrl: "https://soniox.com/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: null,
  models: [],
  serviceKinds: ["stt", "tts"],
  sttConfig: {
    baseUrl: "https://api.soniox.com/v1/transcriptions",
    authType: "apikey",
    authHeader: "bearer",
    format: "soniox",
  },
  ttsConfig: {
    baseUrl: "https://api.soniox.com/v1/text-to-speech",
    authType: "apikey",
    authHeader: "bearer",
    format: "openai-speech",
  },
};
