export default {
  id: "gitlawb",
  alias: "glb",
  display: {
    name: "Gitlawb Opengateway (MiMo)",
    icon: "hub",
    color: "#10B981",
    textIcon: "GLB",
    website: "https://opengateway.gitlawb.com",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    headers: {
      "User-Agent": "OpenClaude/1.0 (linux; x86_64)",
      "X-Title": "OpenClaude CLI",
      "HTTP-Referer": "https://github.com/Gitlawb/openclaude",
    },
  },
  models: [
    {
      id: "mimo-v2.5-pro",
      name: "MiMo-V2.5-Pro",
      maxOutputTokens: 131072,
      contextLength: 1048576,
    },
    {
      id: "mimo-v2.5",
      name: "MiMo-V2.5",
      maxOutputTokens: 131072,
      contextLength: 1048576,
    },
    {
      id: "mimo-v2-pro",
      name: "MiMo-V2-Pro",
      maxOutputTokens: 131072,
      contextLength: 262144,
    },
    {
      id: "mimo-v2-omni",
      name: "MiMo-V2-Omni",
      maxOutputTokens: 131072,
      contextLength: 262144,
    },
    {
      id: "mimo-v2-flash",
      name: "MiMo-V2-Flash",
      maxOutputTokens: 65536,
      contextLength: 262144,
    },
  ],
};
