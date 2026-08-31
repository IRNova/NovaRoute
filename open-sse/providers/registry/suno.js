export default {
  // Web-session flow has no executor/adapter wired - card hidden until implemented.  id: "suno",
  alias: "suno",
  display: {
    name: "Suno",
    icon: "music_note",
    color: "#F59E0B",
    textIcon: "SU",
    website: "https://suno.ai",
  },
  category: "webCookie",
  authHint: "Paste session cookie from suno.ai (Clerk auth)",
  transport: {
    baseUrl: "https://studio-api.suno.ai/api/generate/v2/",
    authType: "cookie",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "chirp-fenix",
      name: "Chirp V5.5",
    },
    {
      id: "chirp-crow",
      name: "Chirp V5",
    },
    {
      id: "chirp-v4",
      name: "Chirp V4",
    },
    {
      id: "chirp-v3-5",
      name: "Chirp V3.5",
    },
  ],
  credentialFields: [
    { id: "token", label: "Session Cookie", placeholder: "session cookie value...", type: "text", required: true, hint: "Open DevTools > Application > Cookies > suno.ai > copy the session cookie value" },
  ],
};