export default {
  id: "deepai",
  alias: "deepai",
  display: {
    name: "DeepAI",
    icon: "psychology",
    color: "#4A90D9",
    textIcon: "DA",
    website: "https://deepai.org",
  },
  category: "apikey",
  authHint: "Use your DeepAI API key. Get one at deepai.org — requires a Pro subscription ($9.99/mo).",
  transport: {
    baseUrl: "https://api.deepai.org",
    format: "custom",
    authType: "apikey",
    auth: {
      header: "x-api-key",
      scheme: "raw",
      combined: true,
    },
  },
  models: [
    {
      id: "text2img",
      name: "Text to Image",
    },
  ],
};
