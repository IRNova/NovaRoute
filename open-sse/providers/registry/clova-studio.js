export default {
  id: "clova-studio",
  alias: "clova",
  display: {
    name: "Naver CLOVA Studio",
    icon: "auto_awesome",
    color: "#03C75A",
    textIcon: "CS",
    website: "https://api.ncloud-docs.com/docs/en/ai-naver-clovastudio-summary",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://clovastudio.stream.ntruss.com/v1/openai/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "HCX-007",
      name: "HCX-007",
    },
    {
      id: "HCX-005",
      name: "HCX-005",
    },
  ],
};
