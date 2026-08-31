// Shared Ollama Local helpers for dashboard API routes.
// Base URL resolution mirrors open-sse/local/detector.js: settings override
// (localFirst.runtimeUrls.ollama) > env LOCAL_OLLAMA_URL > default port.
import { resolveLocalHost } from "open-sse/local/baseUrl.js";

export async function getOllamaBaseUrl() {
  const env = globalThis.process?.env || {};
  try {
    const { getSettings } = await import("@/lib/db/repos/settingsRepo.js");
    const settings = await getSettings().catch(() => null);
    const override = settings?.localFirst?.runtimeUrls?.ollama;
    return resolveLocalHost(override ? { providerSpecificData: { baseUrl: override } } : null, "ollama");
  } catch {
    return env.LOCAL_OLLAMA_URL || "http://localhost:11434";
  }
}

export function isValidOllamaModelName(name) {
  return typeof name === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._\-/:]{0,120}$/.test(name.trim());
}
