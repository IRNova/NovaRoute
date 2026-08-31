export default {
  id: "glhf",
  alias: "glhf",
  display: {
    name: "GLHF",
    icon: "cloud_queue",
    color: "#64748B",
    textIcon: "GLHF",
    website: "https://glhf.chat",
  },
  category: "apikey",
  hasFree: true,
  transport: {
    baseUrl: "https://glhf.chat/api/openai/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    { id: "hf:meta-llama/Llama-3.1-70B-Instruct", name: "Llama 3.1 70B Instruct" },
    { id: "hf:mistralai/Mixtral-8x7B-Instruct-v0.1", name: "Mixtral 8x7B Instruct" },
    { id: "hf:microsoft/Phi-3-mini-4k-instruct", name: "Phi-3 Mini 4K Instruct" },
  ],
  passthroughModels: true,
};
