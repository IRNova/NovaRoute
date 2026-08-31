export default {
  id: "watsonx",
  alias: "watsonx",
  display: {
    name: "IBM watsonx",
    icon: "account_tree",
    color: "#0F4C8C",
    textIcon: "WX",
    website: "https://www.ibm.com/products/watsonx-ai",
    notice: {
      apiKeyUrl: "https://cloud.ibm.com/iam/apikeys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: {
    baseUrl: "https://us-south.ml.cloud.ibm.com/ml/v1/chat/completions",
  },
  models: [
    { id: "ibm/granite-3-8b-instruct", name: "Granite 3 8B Instruct" },
    { id: "ibm/granite-3-2-8b-instruct", name: "Granite 3.2 8B Instruct" },
    { id: "ibm/granite-3-19b-instruct", name: "Granite 3 19B Instruct" },
    { id: "meta-llama/llama-3-3-70b-instruct", name: "Llama 3.3 70B Instruct" },
  ],
};
