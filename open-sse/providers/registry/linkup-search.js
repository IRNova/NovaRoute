export default {
  id: "linkup-search",
  display: {
    deprecated: true,
    deprecationNotice: "Duplicate provider — use \"linkup\" instead.",
    name: "Linkup Search",
    icon: "link",
    color: "#0F766E",
    textIcon: "LU",
    website: "https://linkup.so",
    notice: {
      apiKeyUrl: "https://app.linkup.so/settings",
    },
  },
  category: "apikey",
  authType: "apikey",
  serviceKinds: [
    "webSearch",
  ],
  searchConfig: {
    baseUrl: "https://api.linkup.so/v1/search",
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
