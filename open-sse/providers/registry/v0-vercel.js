export default {
  id: "v0-vercel",
  alias: "v0",
  display: {
    name: "v0 (Vercel)",
    icon: "code_blocks",
    color: "#111827",
    textIcon: "V0",
    website: "https://v0.dev",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.v0.dev/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "v0-1.0-md",
      name: "v0-1.0-md",
    },
    {
      id: "v0-1.5-lg",
      name: "v0-1.5-lg",
    },
    {
      id: "v0-1.5-md",
      name: "v0-1.5-md",
    },
  ],
};
