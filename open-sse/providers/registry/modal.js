export default {
  id: "modal",
  alias: "modal",
  hasFree: true,
  display: {
    name: "Modal",
    icon: "cloud_queue",
    color: "#7C3AED",
    textIcon: "MDL",
    website: "https://modal.com/docs",
  },
  category: "apikey",
  authHint: "Use the bearer token that protects your Modal deployment, if enabled. Base URL should point to your OpenAI-compatible Modal app, for example https://<workspace>--<app>.modal.run/v1.",
  transport: {
    baseUrl: "https://api.modal.ai/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "google/gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
    },
  ],
  passthroughModels: true,
};
