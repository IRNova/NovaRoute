import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/localDb";

export const dynamic = "force-dynamic";

/**
 * GET /api/local-runtimes
 * Probes well-known local AI server ports on this machine and reports which
 * runtimes are alive, their live model lists, and whether a connection already
 * exists for them. Used by the Providers page "Local" auto-detect panel.
 */
const PROBES = [
  { providerId: "ollama-local", label: "Ollama", kind: "ollama", urls: ["http://127.0.0.1:11434"] },
  { providerId: "lm-studio-local", label: "LM Studio", kind: "openai", urls: ["http://127.0.0.1:1234"] },
  { providerId: "llamacpp-local", label: "llama.cpp", kind: "openai", urls: ["http://127.0.0.1:8080", "http://127.0.0.1:8081"] },
  { providerId: "llamafile", label: "LlamaFile", kind: "openai", urls: ["http://127.0.0.1:8888"] },
  { providerId: "vllm", label: "vLLM", kind: "openai", urls: ["http://127.0.0.1:8000"] },
  { providerId: "xinference", label: "Xinference", kind: "openai", urls: ["http://127.0.0.1:9997/v1"] },
  { providerId: "oobabooga", label: "Text-Gen (oobabooga)", kind: "openai", urls: ["http://127.0.0.1:5000"] },
  { providerId: "docker-model-runner", label: "Docker Model Runner", kind: "openai", urls: ["http://127.0.0.1:12434"] },
];

async function probe(kind, base) {
  const baseNorm = String(base || "").replace(/\/+$/, "");
  try {
    if (kind === "ollama") {
      const res = await fetch(`${baseNorm}/api/tags`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) return null;
      const data = await res.json();
      const models = (data?.models || []).map((m) => ({ id: m.name, name: m.name }));
      return models;
    }
    const res = await fetch(`${baseNorm}/v1/models`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map((m) => ({ id: m.id || m.name, name: m.name || m.id }));
  } catch {
    return null;
  }
}

export async function GET() {
  const detections = [];
  for (const p of PROBES) {
    for (const url of p.urls) {
      const models = await probe(p.kind, url);
      if (models !== null) {
        detections.push({
          providerId: p.providerId,
          label: p.label,
          baseUrl: url,
          models,
          modelCount: models.length,
        });
        break; // first reachable URL per runtime wins
      }
    }
  }

  // Mark which detections already have a connection
  const connected = {};
  try {
    const all = await getProviderConnections();
    for (const c of all || []) connected[c.provider] = true;
  } catch { /* best-effort */ }

  return NextResponse.json({ detections, connected });
}
