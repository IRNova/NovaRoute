export default {
  id: "gigachat",
  alias: "gigachat",
  display: {
    name: "GigaChat (Sber)",
    icon: "lock_person",
    color: "#10B981",
    textIcon: "GC",
    website: "https://developers.sber.ru",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://gigachat.devices.sberbank.ru/api/v1",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "GigaChat-2-Max",
      name: "GigaChat-2-Max",
    },
    {
      id: "GigaChat-2-Pro",
      name: "GigaChat-2-Pro",
    },
    {
      id: "GigaChat-2-Lite",
      name: "GigaChat-2-Lite",
    },
  ],
};
