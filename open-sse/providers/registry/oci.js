export default {
  id: "oci",
  alias: "oci",
  display: {
    name: "OCI Generative AI",
    icon: "cloud",
    color: "#C74234",
    textIcon: "OC",
    website: "https://www.oracle.com/cloud/ai/",
    notice: {
      apiKeyUrl: "https://cloud.oracle.com/identity/domains/my-profile/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: {
    baseUrl: "https://inference.generativeai.us-ashburn-1.oci.oraclecloud.com/20231130/actions/chat",
  },
  models: [
    { id: "cohere.command-r-08-2024", name: "Cohere Command R" },
    { id: "cohere.command-r-plus-08-2024", name: "Cohere Command R Plus" },
    { id: "meta.llama-3.1-405b-instruct", name: "Llama 3.1 405B Instruct" },
    { id: "meta.llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct" },
  ],
};
