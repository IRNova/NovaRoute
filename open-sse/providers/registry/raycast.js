export default {
  id: "raycast",
  alias: "rc",
  display: {
    name: "Raycast Pro AI",
    icon: "terminal",
    color: "#FF6363",
    textIcon: "RC",
    website: "https://raycast.com/ai",
  },
  category: "apikey",
  authHint: "Unofficial integration — uses your Raycast Pro subscription via credentials from the macOS app (Auto-Import or manual capture). May break on Raycast updates. Not for redistribution; personal use only.",
  transport: {
    baseUrl: "https://backend.raycast.com/api/v1/ai",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "openai-gpt-5-mini",
      name: "GPT-5 Mini",
      contextLength: 128000,
    },
    {
      id: "openai-gpt-4o-mini",
      name: "GPT-4o Mini",
      contextLength: 128000,
    },
    {
      id: "anthropic-claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      contextLength: 128000,
    },
    {
      id: "google-gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      contextLength: 128000,
    },
    {
      id: "raycast-ray1",
      name: "Ray1",
      contextLength: 128000,
    },
    {
      id: "raycast-ray1-mini",
      name: "Ray1 Mini",
      contextLength: 128000,
    },
    {
      id: "perplexity-sonar",
      name: "Sonar",
      contextLength: 128000,
    },
    {
      id: "perplexity-sonar-pro",
      name: "Sonar Pro",
      contextLength: 128000,
    },
    {
      id: "mistral-open-mistral-nemo",
      name: "Mistral Nemo",
      contextLength: 128000,
    },
    {
      id: "xai-grok-3-mini",
      name: "Grok 3 Mini",
      contextLength: 128000,
    },
  ],
};
