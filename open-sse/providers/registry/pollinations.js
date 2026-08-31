export default {
  id: "pollinations",
  alias: "pol",
  hasFree: true,
  display: {
    name: "Pollinations AI",
    icon: "local_florist",
    color: "#4CAF50",
    textIcon: "PO",
    website: "https://pollinations.ai",
  },
  category: "apikey",
  authHint: "Anonymous/keyless access to the documented free models is best-effort. Local v3.8.50 verification (2026-07-31) returned 401 via Nova Route and Cloudflare 1010 on direct upstream probes from the same network. Premium models still require a Pollinations API key from enter.pollinations.ai.",
  transport: {
    baseUrl: "https://gen.pollinations.ai/v1/chat/completions",
    baseUrls: [
      "https://gen.pollinations.ai/v1/chat/completions",
    ],
    authType: "optional",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "openai",
      name: "OpenAI (Pollinations)",
    },
    {
      id: "openai-fast",
      name: "OpenAI Fast (Pollinations)",
    },
    {
      id: "openai-large",
      name: "OpenAI Large (Pollinations)",
    },
    {
      id: "qwen-coder",
      name: "Qwen Coder (Pollinations)",
    },
    {
      id: "mistral",
      name: "Mistral (Pollinations)",
    },
    {
      id: "gemini",
      name: "Gemini (Pollinations)",
    },
    {
      id: "gemini-flash-lite-3.1",
      name: "Gemini Flash Lite 3.1 (Pollinations)",
    },
    {
      id: "gemini-fast",
      name: "Gemini Fast (Pollinations)",
    },
    {
      id: "deepseek",
      name: "DeepSeek (Pollinations)",
    },
    {
      id: "grok",
      name: "Grok (Pollinations)",
    },
    {
      id: "grok-large",
      name: "Grok Large (Pollinations)",
    },
    {
      id: "gemini-search",
      name: "Gemini Search (Pollinations)",
    },
    {
      id: "midijourney",
      name: "Midijourney (Pollinations)",
    },
    {
      id: "midijourney-large",
      name: "Midijourney Large (Pollinations)",
    },
    {
      id: "claude-fast",
      name: "Claude Fast (Pollinations)",
    },
    {
      id: "claude",
      name: "Claude (Pollinations)",
    },
    {
      id: "claude-large",
      name: "Claude Large (Pollinations)",
    },
    {
      id: "perplexity-fast",
      name: "Perplexity Fast (Pollinations)",
    },
    {
      id: "perplexity-reasoning",
      name: "Perplexity Reasoning (Pollinations)",
    },
    {
      id: "kimi",
      name: "Kimi (Pollinations)",
    },
    {
      id: "gemini-large",
      name: "Gemini Large (Pollinations)",
    },
    {
      id: "nova-fast",
      name: "Nova Fast (Pollinations)",
    },
    {
      id: "nova",
      name: "Nova (Pollinations)",
    },
    {
      id: "glm",
      name: "GLM (Pollinations)",
    },
    {
      id: "minimax",
      name: "MiniMax (Pollinations)",
    },
    {
      id: "mistral-large",
      name: "Mistral Large (Pollinations)",
    },
    {
      id: "polly",
      name: "Polly (Pollinations)",
    },
    {
      id: "qwen-coder-large",
      name: "Qwen Coder Large (Pollinations)",
    },
    {
      id: "qwen-large",
      name: "Qwen Large (Pollinations)",
    },
    {
      id: "qwen-vision",
      name: "Qwen Vision (Pollinations)",
    },
    {
      id: "qwen-safety",
      name: "Qwen Safety (Pollinations)",
    },
  ],
};
