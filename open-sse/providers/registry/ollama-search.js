export default {
  id: "ollama-search",
  alias: "ollama-search",
  display: {
    name: "Ollama Search",
    icon: "search",
    color: "#58A6FF",
    textIcon: "OS",
    website: "https://ollama.com",
  },
  category: "apikey",
  authType: "apikey",
  serviceKinds: [
    "webSearch",
  ],
  searchConfig: {
    baseUrl: "https://ollama.com/api/search",
    method: "POST",
    authType: "apikey",
    authHeader: "bearer",
    searchTypes: [
      "web",
    ],
    defaultMaxResults: 5,
    maxMaxResults: 20,
    timeoutMs: 10000,
    cacheTTLMs: 300000,
  },
};
