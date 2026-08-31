export default {
  id: "iflytek",
  alias: "iflytek",
  hasFree: true,
  display: {
    name: "iFlytek Spark",
    icon: "auto_awesome",
    color: "#0066FF",
    textIcon: "IF",
    website: "https://xinghuo.xfyun.cn",
  },
  category: "apikey",
  authHint: "Get API key at console.xfyun.cn",
  transport: {
    baseUrl: "https://spark-api-open.xf-yun.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "4.0Ultra",
      name: "Spark 4.0 Ultra",
      contextLength: 32768,
    },
    {
      id: "generalv3.5",
      name: "Spark Max (V3.5)",
    },
    {
      id: "max-32k",
      name: "Spark Max 32K",
      contextLength: 32768,
    },
    {
      id: "generalv3",
      name: "Spark Pro",
      contextLength: 8192,
    },
    {
      id: "pro-128k",
      name: "Spark Pro 128K",
      contextLength: 131072,
    },
    {
      id: "lite",
      name: "Spark Lite",
      contextLength: 4096,
    },
  ],
  passthroughModels: true,
};
