export default {
  id: "sensenova",
  alias: "sensenova",
  hasFree: true,
  display: {
    name: "SenseNova",
    icon: "auto_awesome",
    color: "#0066FF",
    textIcon: "SN",
    website: "https://platform.sensenova.cn",
    notice: {
      text: "SenseNova registration appears to require a Chinese (+86) phone number for SMS verification — no international sign-up path is documented, so users outside mainland China may be unable to obtain an API key.",
      signupUrl: "https://platform.sensenova.cn/console",
    },
  },
  category: "apikey",
  authHint: "Get API key at platform.sensenova.cn",
  transport: {
    baseUrl: "https://token.sensenova.cn/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "sensenova-6.7-flash-lite",
      name: "SenseNova 6.7 Flash-Lite",
      toolCalling: true,
      supportsVision: true,
      maxOutputTokens: 65536,
      contextLength: 262144,
    },
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      supportsReasoning: true,
      maxOutputTokens: 65536,
      contextLength: 1048576,
      interleavedField: "reasoning_content",
    },
    {
      id: "glm-5.2",
      name: "GLM 5.2",
      supportsReasoning: true,
      maxOutputTokens: 65536,
      contextLength: 1048576,
      interleavedField: "reasoning_content",
    },
  ],
  passthroughModels: true,
};
