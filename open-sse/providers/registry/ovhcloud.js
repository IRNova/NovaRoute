export default {
  id: "ovhcloud",
  alias: "ovh",
  display: {
    name: "OVHcloud AI",
    icon: "cloud",
    color: "#2563EB",
    textIcon: "OVH",
    website: "https://www.ovhcloud.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions",
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "Meta-Llama-3_3-70B-Instruct",
      name: "Meta-Llama-3_3-70B-Instruct",
    },
    {
      id: "Qwen2.5-Coder-32B-Instruct",
      name: "Qwen2.5-Coder-32B-Instruct",
    },
    {
      id: "Mistral-Small-3.2-24B-Instruct-2506",
      name: "Mistral-Small-3.2-24B-Instruct-2506",
    },
  ],
};
