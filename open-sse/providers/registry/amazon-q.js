export default {
  id: "amazon-q",
  alias: "amzq",
  // Duplicate of the canonical card / no connect handler yet - hidden from UI
  hasFree: true,
  display: {
    name: "Amazon Q",
    icon: "cloud",
    color: "#FF9900",
    textIcon: "AQ",
    website: "https://aws.amazon.com/q/",
    notice: {
      apiKeyUrl: "https://console.aws.amazon.com/iamv2/home#/security_credentials",
    },
  },
  category: "oauth",
  authModes: ["oauth", "apikey"],
  hasOAuth: true,
  transport: {
    baseUrl: "https://q.us-east-1.amazonaws.com/v1/chat/completions",
    validateUrl: "https://q.us-east-1.amazonaws.com/v1/models",
  },
  models: [],
  passthroughModels: true,
};
