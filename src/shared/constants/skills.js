// Agent Skills metadata — single source of truth for /dashboard/skills page.
// Each skill = 1 URL the user copies and pastes to any AI agent.
//
// These URLs used to point at raw.githubusercontent.com in the upstream
// author's repo. Pasting one told the agent to fetch and follow instructions
// from a repository nobody here controls, resolved at the moment of the paste.
// They now resolve against this instance and are served by
// src/app/api/skills/[id]/route.js from the files bundled with this build.

export const SKILLS_API_PATH = "/api/skills";

export const SKILLS = [
  {
    id: "NovaRoute",
    name: "NovaRoute (Entry)",
    description: "Setup + index of all capabilities. Start here — covers base URL, auth, model discovery, and links to every capability skill.",
    endpoint: null,
    icon: "hub",
    isEntry: true,
  },
  {
    id: "NovaRoute-chat",
    name: "Chat",
    description: "Chat / code-gen via OpenAI or Anthropic format with streaming.",
    endpoint: "/v1/chat/completions",
    icon: "chat",
  },
  {
    id: "NovaRoute-image",
    name: "Image Generation",
    description: "Text-to-image via DALL-E, Imagen, FLUX, MiniMax, SDWebUI…",
    endpoint: "/v1/images/generations",
    icon: "image",
  },
  {
    id: "NovaRoute-tts",
    name: "Text-to-Speech",
    description: "OpenAI / ElevenLabs / Edge / Google / Deepgram voices.",
    endpoint: "/v1/audio/speech",
    icon: "record_voice_over",
  },
  {
    id: "NovaRoute-stt",
    name: "Speech-to-Text",
    description: "Transcribe audio via OpenAI Whisper, Groq, Gemini, Deepgram, AssemblyAI…",
    endpoint: "/v1/audio/transcriptions",
    icon: "mic",
  },
  {
    id: "NovaRoute-embeddings",
    name: "Embeddings",
    description: "Vectors for RAG / semantic search via OpenAI, Gemini, Mistral…",
    endpoint: "/v1/embeddings",
    icon: "scatter_plot",
  },
  {
    id: "NovaRoute-web-search",
    name: "Web Search",
    description: "Tavily / Exa / Brave / Serper / SearXNG / Google PSE / You.com.",
    endpoint: "/v1/search",
    icon: "search",
  },
  {
    id: "NovaRoute-web-fetch",
    name: "Web Fetch",
    description: "URL → markdown / text / HTML via Firecrawl, Jina, Tavily, Exa.",
    endpoint: "/v1/web/fetch",
    icon: "language",
  },
  {
    id: "NovaRoute-video",
    name: "Video Generation",
    description: "Text-to-video via Runway, Pika, Kling, Sora, Minimax…",
    endpoint: "/v1/video/generations",
    icon: "videocam",
  },
  {
    id: "NovaRoute-mcp",
    name: "MCP Tools",
    description: "Execute tools via MCP servers — Exa, Tavily, Browser, Filesystem.",
    endpoint: "/api/mcp/tools",
    icon: "build",
  },
  {
    id: "NovaRoute-novabot",
    name: "NovaBot Agent",
    description: "Autonomous AI agent with task execution, learning, and multi-turn conversations.",
    endpoint: "/api/sessions",
    icon: "smart_toy",
  },
  {
    id: "NovaRoute-smart-router",
    name: "Smart Router",
    description: "Intelligent provider selection based on cost, quality, speed, and health.",
    endpoint: "/api/routing/smart",
    icon: "route",
  },
];

// Path only. Reading window.location here would make the server and client
// render different text and break hydration; the page adds the origin after
// mount, which it must, because the agent that fetches this URL is not running
// in the browser that copied it.
export function getSkillPath(id) {
  return `${SKILLS_API_PATH}/${id}`;
}

export function getSkillRawUrl(id, origin = "") {
  return `${origin}${getSkillPath(id)}`;
}
