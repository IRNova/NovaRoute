import { NextResponse } from "next/server";

// Real catalog of the gateway's public surface (served to /dashboard/api-endpoints).
const ENDPOINTS = [
  { method: "POST", path: "/v1/chat/completions", description: "OpenAI-compatible chat completions (streaming supported)", authRequired: true, rateLimit: "per-key limits" },
  { method: "POST", path: "/v1/completions", description: "Legacy text completions", authRequired: true, rateLimit: "per-key limits" },
  { method: "POST", path: "/v1/messages", description: "Anthropic Messages format ingress", authRequired: true, rateLimit: "per-key limits" },
  { method: "POST", path: "/v1/responses", description: "OpenAI Responses API ingress", authRequired: true, rateLimit: "per-key limits" },
  { method: "GET", path: "/v1/models", description: "List available routed models", authRequired: true, rateLimit: "—" },
  { method: "POST", path: "/v1/embeddings", description: "Embeddings via configured embedding providers", authRequired: true, rateLimit: "per-key limits" },
  { method: "POST", path: "/v1/images/generations", description: "Image generation", authRequired: true, rateLimit: "provider quotas" },
  { method: "POST", path: "/v1/audio/speech", description: "Text-to-speech", authRequired: true, rateLimit: "provider quotas" },
  { method: "POST", path: "/v1/audio/transcriptions", description: "Speech-to-text", authRequired: true, rateLimit: "provider quotas" },
  { method: "POST", path: "/v1/search", description: "Web search aggregation", authRequired: true, rateLimit: "engine quotas" },
  { method: "GET", path: "/api/health", description: "Service health probe", authRequired: false, rateLimit: "—" },
  { method: "GET", path: "/api/tags", description: "Ollama-compatible model list (external clients)", authRequired: false, rateLimit: "—" },
];

export async function GET() {
  return NextResponse.json({ endpoints: ENDPOINTS });
}
