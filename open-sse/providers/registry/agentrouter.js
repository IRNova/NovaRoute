import { CLAUDE_CLI_SPOOF_HEADERS } from "../shared.js";

export default {
  id: "agentrouter",
  alias: "agentrouter",
  hasFree: true,
  display: {
    name: "AgentRouter",
    icon: "router",
    color: "#10B981",
    textIcon: "AR",
    website: "https://agentrouter.org",
  },
  category: "apikey",
  transport: {
    baseUrl: "https://agentrouter.org/v1/messages",
    format: "claude",
    authType: "apikey",
    // agentrouter WAF only accepts requests that carry the Claude Code wire image
    // (User-Agent, X-App, X-Stainless-*, Anthropic-Dangerous-Direct-Browser-Access, ...)
    headers: { ...CLAUDE_CLI_SPOOF_HEADERS },
    auth: {
      header: "x-api-key",
      scheme: "raw",
      combined: true,
    },
  },
  models: [
    {
      id: "claude-opus-4-8",
      name: "Claude Opus 4.8",
      contextLength: 128000,
    },
    {
      id: "claude-opus-5",
      name: "Claude Opus 5",
      contextLength: 128000,
    },
    {
      id: "gpt-5.6-sol",
      name: "GPT-5.6 Sol",
      contextLength: 128000,
    },
  ],
  passthroughModels: true,
};
