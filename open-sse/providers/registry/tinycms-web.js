export default {
  id: "tinycms-web",
  alias: "tcw",
  hasFree: true,
  display: {
    name: "TinyCMS Web (Free/Sub)",
    icon: "layers",
    color: "#ED8936",
    textIcon: "TC",
    website: "https://site.tinycms.xyz",
  },
  category: "webCookie",
  authHint: "Go to site.tinycms.xyz, open DevTools → Application → Local Storage, copy the value of 'app-config-uuid' (starts with 'R'), and paste it here.",
  cookieHint: "Open DevTools → Application → Local Storage → site.tinycms.xyz → copy app-config-uuid",
  transport: {
    baseUrl: "https://gov.freegpt.win/api/openai/oneapi/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "gpt-5-free",
      name: "GPT 5 Free",
    },
    {
      id: "gpt-5.3-free",
      name: "GPT 5.3 Free (Multimodal/Vision)",
    },
    {
      id: "gpt-5.3-thinking-free",
      name: "GPT 5.3 Thinking Free",
      supportsReasoning: true,
    },
    {
      id: "gpt-5.4-mini",
      name: "GPT 5.4 Mini",
    },
    {
      id: "gpt-5.4-nano",
      name: "GPT 5.4 Nano",
    },
    {
      id: "gpt-5-nano",
      name: "GPT 5 Nano",
    },
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
    },
    {
      id: "gemini-3-pro-preview",
      name: "Gemini 3 Pro Preview",
    },
    {
      id: "gemini-3.1-flash-lite-preview",
      name: "Gemini 3.1 Flash Lite Preview",
    },
    {
      id: "grok-4.20-fast",
      name: "Grok 4.20 Fast",
    },
    {
      id: "grok-4.20",
      name: "Grok 4.20",
    },
    {
      id: "grok-imagine",
      name: "Grok Imagine (Image Gen)",
    },
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
    },
    {
      id: "claude-sonnet-5",
      name: "Claude Sonnet 5",
    },
    {
      id: "gpt-image-2",
      name: "GPT Image 2 (Image Gen)",
    },
    {
      id: "qwen3.6-plus",
      name: "Qwen 3.6 Plus",
    },
  ],
  credentialFields: [
    { id: "token", label: "App Config UUID", placeholder: "Rxxxxxxxx...", type: "text", required: true, hint: "Open DevTools > Application > Local Storage > site.tinycms.xyz > copy app-config-uuid value (starts with R)" },
  ],
};