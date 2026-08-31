export default {
  id: "yolo-auto",
  alias: "yolo-auto",
  hasFree: true,
  display: {
    name: "Yolo-Auto",
    icon: "auto_awesome",
    color: "#F59E0B",
    textIcon: "YA",
    website: "https://yolo-auto.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://yolo-auto.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://yolo-auto.com/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "qwen3.6-35b-a3b",
      name: "Qwen 3.6 35B A3B",
    },
  ],
  passthroughModels: true,
};
