export default {
  id: "veoaifree-web",
  alias: "veo-free",
  hasFree: true,
  display: {
    name: "Veo AI Free",
    icon: "videocam",
    color: "#8B5CF6",
    textIcon: "VF",
    website: "https://veoaifree.com",
  },
  category: "free",
  noAuth: true,
  authHint: "No auth required. Rate limited to 6 requests/hour per IP.",
  transport: {
    baseUrl: "https://veoaifree.com/wp-admin/admin-ajax.php",
    authType: "none",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  serviceKinds: [
    "video",
  ],
  models: [
    {
      id: "veo",
      name: "VEO 3.1",
      toolCalling: false,
    },
    {
      id: "seedance",
      name: "Seedance",
      toolCalling: false,
    },
  ],
};
