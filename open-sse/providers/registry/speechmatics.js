export default {
  id: "speechmatics",
  alias: "speechmatics",
  hasFree: true,
  display: {
    name: "Speechmatics",
    icon: "mic",
    color: "#0A2540",
    textIcon: "SM",
    website: "https://www.speechmatics.com",
    notice: {
      apiKeyUrl: "https://speechmatics.com/account/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: null,
  models: [],
  serviceKinds: ["stt"],
  sttConfig: {
    baseUrl: "https://asr-api.speechmatics.com/v1",
    authType: "apikey",
    authHeader: "bearer",
    format: "speechmatics",
  },
};
