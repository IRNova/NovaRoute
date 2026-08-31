export default {
  id: "internlm",
  alias: "internlm",
  hasFree: true,
  display: {
    name: "InternLM (Intern-S1)",
    icon: "auto_awesome",
    color: "#4F46E5",
    textIcon: "IL",
    website: "https://internlm.intern-ai.org.cn/",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://chat.intern-ai.org.cn/api/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "intern-s1-pro",
      name: "Intern-S1 Pro",
    },
    {
      id: "intern-s1",
      name: "Intern-S1",
    },
    {
      id: "intern-s1-mini",
      name: "Intern-S1 Mini",
    },
    {
      id: "internvl3.5-latest",
      name: "InternVL3.5 Latest",
    },
    {
      id: "intern-latest",
      name: "Intern Latest",
    },
  ],
};
