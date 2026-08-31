export default {
  id: "ant-ling",
  alias: "ling",
  hasFree: true,
  display: {
    name: "Ant Ling / Ring (inclusionAI)",
    icon: "auto_awesome",
    color: "#1677FF",
    textIcon: "AL",
    website: "https://developer.ant-ling.com/en/docs/",
  },
  category: "apikey",
  authHint: "Register and create an API key at the Ant Ling API console (https://chat.ant-ling.com/open), then paste it here. Nova Route routes chat traffic to https://api.ant-ling.com/v1/chat/completions; the provider is OpenAI-compatible and also exposes an Anthropic-compatible surface.",
  transport: {
    baseUrl: "https://api.ant-ling.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "Ling-2.6-1T",
      name: "Ling 2.6 1T",
    },
    {
      id: "Ring-2.6-1T",
      name: "Ring 2.6 1T",
    },
    {
      id: "Ling-2.6-flash",
      name: "Ling 2.6 Flash",
    },
  ],
};
