export default {
  id: "zai",
  alias: "zai",
  display: {
    deprecated: true,
    deprecationNotice: "Duplicate provider — use \"glm\" instead.",
    name: "Z.AI",
    icon: "psychology",
    color: "#2563EB",
    textIcon: "ZA",
    website: "https://open.bigmodel.cn",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.z.ai/api/anthropic/v1/messages",
    urlSuffix: "?beta=true",
    format: "claude",
    authType: "apikey",
    auth: {
      header: "x-api-key",
      scheme: "raw",
      combined: true,
    },
    headers: {
      "Anthropic-Version": "2023-06-01",
    },
  },
  models: [
    {
      id: "glm-5.2",
      name: "GLM 5.2",
    },
    {
      id: "glm-5.1",
      name: "GLM 5.1",
    },
    {
      id: "glm-5",
      name: "GLM 5",
    },
    {
      id: "glm-5-turbo",
      name: "GLM 5 Turbo",
    },
    {
      id: "glm-4.7-flash",
      name: "GLM 4.7 Flash",
    },
    {
      id: "glm-4.7",
      name: "GLM 4.7",
    },
  ],
};
