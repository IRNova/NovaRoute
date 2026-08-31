export default {
  id: "xiaomi-mimo-token-plan",
  alias: "mimotp",
  display: {
    name: "Xiaomi MiMo Token Plan",
    icon: "devices",
    color: "#EA580C",
    textIcon: "MT",
    website: "https://mimo.mi.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "mimo-v2.5-pro",
      name: "MiMo-V2.5-Pro",
      maxOutputTokens: 131072,
      contextLength: 1048576,
    },
    {
      id: "mimo-v2.5",
      name: "MiMo-V2.5",
      maxOutputTokens: 131072,
      contextLength: 1048576,
    },
  ],
};
