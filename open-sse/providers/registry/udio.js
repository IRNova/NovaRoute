export default {
  id: "udio",
  alias: "udio",
  display: {
    name: "Udio",
    icon: "music_note",
    color: "#10B981",
    textIcon: "UD",
    website: "https://udio.com",
  },
  category: "apikey",
  authHint: "Paste session cookie from udio.com (Supabase auth)",
  transport: {
    baseUrl: "https://www.udio.com/api/generate-proxy",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "udio-default",
      name: "Udio Default",
    },
  ],
};
