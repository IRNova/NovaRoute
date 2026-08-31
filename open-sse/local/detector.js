// Local runtime detection (Ollama / LM Studio / llama.cpp).
// Fail-open by design: probing never throws — a dead runtime just reports
// `running: false`. Results are cached briefly so hot paths (smart routing)
// don't hammer local ports on every request.
import { LOCAL_RUNTIMES, providerIdForRuntime } from "./baseUrl.js";

const CACHE_TTL_MS = 30000;
let cache = { ts: 0, result: null };

const PROBES = {
  "ollama": { path: "/api/tags", list: (j) => (j?.models || []).map((m) => m.name).filter(Boolean) },
  "lm-studio": { path: "/v1/models", list: (j) => (j?.data || []).map((m) => m.id || m.name).filter(Boolean) },
  "llamacpp": { path: "/v1/models", list: (j) => (j?.data || []).map((m) => m.id || m.name).filter(Boolean) },
};

async function probeRuntime(runtime, baseUrl, timeoutMs, fetchImpl) {
  const probe = PROBES[runtime];
  if (!probe) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${baseUrl}${probe.path}`;
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return { runtime, running: false, models: [], baseUrl, provider: providerIdForRuntime(runtime) };
    const json = await res.json().catch(() => null);
    return {
      runtime,
      running: true,
      models: probe.list(json),
      baseUrl,
      provider: providerIdForRuntime(runtime),
    };
  } catch {
    return { runtime, running: false, models: [], baseUrl, provider: providerIdForRuntime(runtime) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the probe base URL for a runtime, honouring a settings override.
 * Lazy imports keep this module import-safe in tests without a settings DB.
 */
async function resolveBase(runtime) {
  try {
    const { resolveLocalHost } = await import("./baseUrl.js");
    const { getSettings } = await import("@/lib/db/repos/settingsRepo.js");
    const settings = await getSettings().catch(() => null);
    const override = settings?.localFirst?.runtimeUrls?.[runtime];
    return resolveLocalHost(
      override ? { providerSpecificData: { baseUrl: override } } : null,
      runtime
    );
  } catch {
    return defaultBase(runtime);
  }
}

function defaultBase(runtime) {
  return baseFromEnv(runtime);
}

function baseFromEnv(runtime) {
  const env = globalThis.process?.env || {};
  const key = `LOCAL_${runtime.toUpperCase().replace("-", "_")}_URL`;
  return env[key] || (runtime === "ollama" ? "http://localhost:11434" : runtime === "lm-studio" ? "http://localhost:1234" : "http://localhost:8080");
}

/**
 * Detect which local runtimes are up and what models they expose.
 * @param {object} opts
 * @param {Array<string>} [opts.runtimes] - runtimes to probe (default: all)
 * @param {number} [opts.timeoutMs] - per-runtime probe timeout
 * @param {boolean} [opts.noCache] - bypass the short TTL cache
 * @param {Function} [opts.fetchImpl] - fetch override (tests)
 * @returns {Promise<Array<{runtime, running, models, baseUrl, provider}>>}
 */
export async function detectLocalRuntimes(opts = {}) {
  const { runtimes = LOCAL_RUNTIMES, timeoutMs = 1500, noCache = false, fetchImpl } = opts;
  const f = fetchImpl || globalThis.fetch;
  if (!f) return runtimes.map((r) => ({ runtime: r, running: false, models: [], baseUrl: "" }));

  if (!noCache && Date.now() - cache.ts < CACHE_TTL_MS && cache.result) return cache.result;

  try {
    const results = await Promise.all(
      runtimes.map(async (runtime) => {
        const base = await resolveBase(runtime);
        return probeRuntime(runtime, base, timeoutMs, f);
      })
    );
    const merged = results
      .filter(Boolean)
      .map((r) => ({ ...r, baseUrl: r.baseUrl || defaultBase(r.runtime) }));
    cache = { ts: Date.now(), result: merged };
    return merged;
  } catch {
    return runtimes.map((r) => ({ runtime: r, running: false, models: [], baseUrl: baseFromEnv(r) }));
  }
}

/** Clear the detection cache (used by tests). */
export function resetLocalCache() {
  cache = { ts: 0, result: null };
}
