export default {
  id: "lambda-ai",
  alias: "lambda",
  display: {
    name: "Lambda AI",
    icon: "bolt",
    color: "#7C3AED",
    textIcon: "LA",
    website: "https://lambda.ai",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.lambda.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "deepseek-r1-671b",
      name: "deepseek-r1-671b",
    },
    {
      id: "llama3.3-70b-instruct-fp8",
      name: "llama3.3-70b-instruct-fp8",
    },
    {
      id: "qwen25-coder-32b-instruct",
      name: "qwen25-coder-32b-instruct",
    },
  ],
};
