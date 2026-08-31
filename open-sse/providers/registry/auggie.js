export default {
  id: "auggie",
  alias: "aug",
  display: {
    name: "Augment (Auggie CLI)",
    icon: "terminal",
    color: "#7C3AED",
    textIcon: "AU",
    website: "https://augmentcode.com",
    notice: {
      text: "Augment (Auggie CLI) requires the `auggie` binary installed and authenticated locally (`auggie login`). Nova Route spawns it as a subprocess and never sees or stores your Augment credentials.",
    },
  },
  category: "free",
  noAuth: true,
  authHint: "No API key stored by Nova Route. Install the Auggie CLI and run `auggie login` on this machine, then Nova Route spawns it locally for each request.",
  transport: {
    baseUrl: "auggie://cli/stdio",
    authType: "none",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  serviceKinds: [
    "llm",
  ],
  models: [
    {
      id: "sonnet4.6",
      name: "Sonnet 4.6",
      contextLength: 200000,
    },
    {
      id: "fable-5",
      name: "Claude Fable 5",
      contextLength: 200000,
    },
    {
      id: "haiku4.5",
      name: "Haiku 4.5",
      contextLength: 200000,
    },
    {
      id: "sonnet4.5",
      name: "Sonnet 4.5",
      contextLength: 200000,
    },
    {
      id: "sonnet4.6-500k",
      name: "Sonnet 4.6 (500K)",
      contextLength: 500000,
    },
    {
      id: "sonnet5-high",
      name: "Claude Sonnet 5",
      contextLength: 200000,
    },
    {
      id: "sonnet5-500k",
      name: "Claude Sonnet 5 (500K)",
      contextLength: 500000,
    },
    {
      id: "opus4.5",
      name: "Opus 4.5",
      contextLength: 200000,
    },
    {
      id: "opus4.6",
      name: "Opus 4.6",
      contextLength: 200000,
    },
    {
      id: "opus4.6-500k",
      name: "Opus 4.6 (500K)",
      contextLength: 500000,
    },
    {
      id: "opus4.7",
      name: "Opus 4.7",
      contextLength: 200000,
    },
    {
      id: "opus4.7-500k",
      name: "Opus 4.7 (500K)",
      contextLength: 500000,
    },
    {
      id: "opus4.8",
      name: "Opus 4.8",
      contextLength: 200000,
    },
    {
      id: "gemini-3.1-pro-preview",
      name: "Gemini 3.1 Pro",
      contextLength: 1000000,
    },
    {
      id: "gpt5",
      name: "GPT-5",
      contextLength: 200000,
    },
    {
      id: "gpt5.1",
      name: "GPT-5.1",
      contextLength: 200000,
    },
    {
      id: "gpt5.2",
      name: "GPT-5.2",
      contextLength: 200000,
    },
    {
      id: "gpt5.4",
      name: "GPT-5.4",
      contextLength: 200000,
    },
    {
      id: "gpt5.4-mini",
      name: "GPT-5.4 Mini",
      contextLength: 200000,
    },
    {
      id: "gpt5.5",
      name: "GPT-5.5",
      contextLength: 200000,
    },
    {
      id: "gpt5.6-luna",
      name: "GPT-5.6 Luna",
      contextLength: 200000,
    },
    {
      id: "gpt5.6-sol",
      name: "GPT-5.6 Sol",
      contextLength: 200000,
    },
    {
      id: "gpt5.6-terra",
      name: "GPT-5.6 Terra",
      contextLength: 200000,
    },
    {
      id: "glm-5.2",
      name: "GLM 5.2",
      contextLength: 200000,
    },
    {
      id: "kimi-k2.6",
      name: "Kimi K2.6",
      contextLength: 131000,
    },
    {
      id: "kimi-k2.7",
      name: "Kimi K2.7 Code",
      contextLength: 131000,
    },
    {
      id: "prism-a",
      name: "Prism (Claude + Gemini)",
      contextLength: 200000,
    },
    {
      id: "prism-b",
      name: "Prism (GPT + Kimi)",
      contextLength: 200000,
    },
  ],
};
