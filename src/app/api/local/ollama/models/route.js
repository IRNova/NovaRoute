import { NextResponse } from "next/server";
import { getOllamaBaseUrl } from "@/lib/localOllama";
import { OLLAMA_MODEL_CATALOG } from "@/shared/constants/ollamaCatalog";

/**
 * GET /api/local/ollama/models
 * Installed models (from the local daemon) merged with the curated catalog.
 */
export async function GET() {
  const base = await getOllamaBaseUrl();
  let installed = [];
  let running = false;
  let error = "";

  try {
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      running = true;
      const json = await res.json();
      installed = (json?.models || []).map((m) => ({
        name: m.name,
        size: m.size || 0,
        modifiedAt: m.modified_at || "",
        family: m.details?.family || "",
        parameterSize: m.details?.parameter_size || "",
        quantization: m.details?.quantization_level || "",
      }));
    } else {
      error = `Ollama responded with HTTP ${res.status}`;
    }
  } catch (err) {
    error = `Ollama is not reachable at ${base}`;
  }

  const installedNames = new Set(
    installed.map((m) => m.name.replace(/:latest$/, ""))
  );
  const catalog = OLLAMA_MODEL_CATALOG.map((entry) => ({
    ...entry,
    installed:
      installedNames.has(entry.name) ||
      installedNames.has(entry.name.split(":")[0]),
  }));

  return NextResponse.json({ running, baseUrl: base, installed, catalog, error });
}
