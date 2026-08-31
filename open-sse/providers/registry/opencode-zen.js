export default {
  id: "opencode-zen",
  alias: "opencode-zen",
  display: {
    name: "OpenCode Zen",
    icon: "opencode",
    color: "#6366f1",
    website: "https://opencode.ai/zen",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://opencode.ai/zen/v1",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
    modelsFetcher: {
      url: "https://opencode.ai/zen/v1/models",
      type: "openai",
    },
  },
  models: [
    {
      id: "big-pickle",
      name: "Big Pickle",
      supportsReasoning: true,
      interleavedField: "reasoning_content",
      contextLength: 200000,
    },
    {
      id: "gpt-5-nano",
      name: "GPT 5 Nano",
      contextLength: 400000,
    },
    {
      id: "gpt-5",
      name: "GPT 5",
      contextLength: 200000,
    },
    {
      id: "gpt-5-codex",
      name: "GPT 5 Codex",
      contextLength: 200000,
    },
    {
      id: "gpt-5.1",
      name: "GPT 5.1",
      contextLength: 200000,
    },
    {
      id: "gpt-5.1-codex",
      name: "GPT 5.1 Codex",
      contextLength: 200000,
    },
    {
      id: "gpt-5.1-codex-max",
      name: "GPT 5.1 Codex Max",
      contextLength: 200000,
    },
    {
      id: "gpt-5.1-codex-mini",
      name: "GPT 5.1 Codex Mini",
      contextLength: 200000,
    },
    {
      id: "gpt-5.2",
      name: "GPT 5.2",
      contextLength: 200000,
    },
    {
      id: "gpt-5.2-codex",
      name: "GPT 5.2 Codex",
      contextLength: 200000,
    },
    {
      id: "gpt-5.3-codex",
      name: "GPT 5.3 Codex",
      contextLength: 200000,
    },
    {
      id: "gpt-5.3-codex-spark",
      name: "GPT 5.3 Codex Spark",
      contextLength: 200000,
    },
    {
      id: "gpt-5.4",
      name: "GPT 5.4",
      contextLength: 200000,
    },
    {
      id: "gpt-5.4-mini",
      name: "GPT 5.4 Mini",
      contextLength: 200000,
    },
    {
      id: "gpt-5.4-nano",
      name: "GPT 5.4 Nano",
      contextLength: 200000,
    },
    {
      id: "gpt-5.4-pro",
      name: "GPT 5.4 Pro",
      contextLength: 200000,
    },
    {
      id: "gpt-5.5",
      name: "GPT 5.5",
      contextLength: 200000,
    },
    {
      id: "gpt-5.5-pro",
      name: "GPT 5.5 Pro",
      contextLength: 200000,
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude Haiku 4.5",
      contextLength: 200000,
    },
    {
      id: "claude-sonnet-4",
      name: "Claude Sonnet 4",
      contextLength: 200000,
    },
    {
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      contextLength: 200000,
    },
    {
      id: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      contextLength: 200000,
    },
    {
      id: "claude-opus-4-1",
      name: "Claude Opus 4.1",
      contextLength: 200000,
    },
    {
      id: "claude-opus-4-5",
      name: "Claude Opus 4.5",
      contextLength: 200000,
    },
    {
      id: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      contextLength: 200000,
    },
    {
      id: "claude-opus-4-7",
      name: "Claude Opus 4.7",
      contextLength: 200000,
    },
    {
      id: "gemini-3-flash",
      name: "Gemini 3 Flash",
      contextLength: 200000,
    },
    {
      id: "gemini-3.1-pro",
      name: "Gemini 3.1 Pro",
      contextLength: 200000,
    },
    {
      id: "gemini-3.5-flash",
      name: "Gemini 3.5 Flash",
      contextLength: 200000,
    },
    {
      id: "grok-build-0.1",
      name: "Grok Build 0.1",
      contextLength: 200000,
    },
    {
      id: "glm-5",
      name: "GLM-5",
      contextLength: 200000,
    },
    {
      id: "glm-5.1",
      name: "GLM-5.1",
      contextLength: 200000,
    },
    {
      id: "minimax-m3",
      name: "MiniMax M3",
      supportsVision: true,
      contextLength: 1048576,
    },
    {
      id: "minimax-m2.5",
      name: "MiniMax M2.5",
      contextLength: 200000,
    },
    {
      id: "minimax-m2.7",
      name: "MiniMax M2.7",
      contextLength: 200000,
    },
    {
      id: "kimi-k2.5",
      name: "Kimi K2.5",
      contextLength: 200000,
    },
    {
      id: "kimi-k2.6",
      name: "Kimi K2.6",
      contextLength: 200000,
    },
    {
      id: "qwen3.5-plus",
      name: "Qwen3.5 Plus",
      supportsVision: false,
      targetFormat: "claude",
      contextLength: 200000,
    },
    {
      id: "qwen3.6-plus",
      name: "Qwen3.6 Plus",
      supportsVision: false,
      targetFormat: "claude",
      contextLength: 200000,
    },
    {
      id: "deepseek-v4-flash-free",
      name: "DeepSeek V4 Flash Free",
      supportsReasoning: true,
      contextLength: 200000,
    },
    {
      id: "mimo-v2.5-free",
      name: "MiMo V2.5 Free",
      contextLength: 200000,
    },
    {
      id: "hy3-free",
      name: "HY3 Free",
      contextLength: 200000,
    },
    {
      id: "nemotron-3-ultra-free",
      name: "Nemotron 3 Ultra Free",
      contextLength: 1000000,
    },
    {
      id: "north-mini-code-free",
      name: "North Mini Code Free",
      contextLength: 200000,
    },
  ],
  passthroughModels: true,
};
