export default {
  id: "fishaudio",
  alias: "fishaudio",
  display: {
    name: "Fish Audio",
    icon: "record_voice_over",
    color: "#3B82F6",
    textIcon: "FA",
    website: "https://fish.audio",
    notice: {
      apiKeyUrl: "https://fish.audio/settings",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: {
    baseUrl: "https://api.fish.audio/v1/chat/completions",
  },
  models: [],
  serviceKinds: ["tts"],
  ttsConfig: {
    baseUrl: "https://api.fish.audio/v1/tts",
    authType: "apikey",
    authHeader: "bearer",
    format: "fish-audio",
  },
};
