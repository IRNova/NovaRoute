// Candidate selection for adaptive routing.
// Builds a ranked list of (provider, model) pairs from active connections,
// filters by request capabilities, and ranks with the 4-factor scorer.
import { getCapabilitiesForModel } from "../providers/capabilities.js";
import { getModelsByProviderId } from "../config/providerModels.js";
import { getPricingForModel } from "../providers/pricing.js";
import { rankCandidates } from "./scorer.js";
import { getStatsMap } from "./predictor.js";
import { DEFAULT_MAX_CANDIDATES } from "../config/routingConfig.js";

const HARD_CAPS = new Set(["vision", "pdf", "audioInput", "videoInput"]);
const LLM_KINDS = new Set(["llm", "chat", "reasoning", "coding", undefined, null]);

async function getActiveConnections() {
  try {
    const { getProviderConnections } = await import("@/lib/db/repos/connectionsRepo.js");
    const all = await getProviderConnections({ isActive: true });
    return all;
  } catch {
    return [];
  }
}

/**
 * Build the provider→model candidate pool from active connections.
 * @param {Set<string>} requiredCaps - hard capabilities the request needs
 * @returns {Array<{provider: string, model: string}>}
 */
export function buildCandidatePool(connections, requiredCaps) {
  const seen = new Set();
  const pool = [];
  for (const conn of connections) {
    const provider = conn.provider;
    if (!provider) continue;
    const models = getModelsByProviderId(provider) || [];
    for (const m of models) {
      const kind = m.kind || m.type;
      if (!LLM_KINDS.has(kind)) continue; // skip image/tts/embedding/speech
      const modelId = m.id;
      if (!modelId) continue;
      const key = `${provider}|${modelId}`;
      if (seen.has(key)) continue;
      // Drop models that can't satisfy hard input capabilities (e.g. vision).
      const caps = getCapabilitiesForModel(provider, modelId);
      const missingHard = [...(requiredCaps || [])].filter((c) => HARD_CAPS.has(c) && caps[c] !== true);
      if (missingHard.length > 0) continue;
      seen.add(key);
      pool.push({ provider, model: modelId });
    }
  }
  return pool;
}

/**
 * Resolve a price map for candidates. Unknown price → neutral (scorer handles).
 */
export async function buildPriceMap(candidates) {
  const map = {};
  for (const c of candidates) {
    const key = `${c.provider}|${c.model}`;
    if (map[key] !== undefined) continue;
    const pricing = getPricingForModel(c.provider, c.model);
    // estimate per-1M input price (first non-null of input/cached)
    map[key] = pricing?.input ?? pricing?.cached ?? null;
  }
  return map;
}

/**
 * Resolve quota fractions (0..1) for candidates. Provider usage queries are
 * async and can be slow — wrapped in a bounded probe with short timeout, and
 * any failure degrades to unknown (scorer neutral 0.5).
 * @param {object} quotaCache - { provider: { fraction: number, ts: number } } TTL cache
 */
export async function buildQuotaMap(candidates, quotaCache = {}, quotaTtlMs = 60000) {
  const map = {};
  const providers = [...new Set(candidates.map((c) => c.provider))];
  const now = Date.now();
  for (const provider of providers) {
    const cached = quotaCache[provider];
    let fraction = null;
    if (cached && now - cached.ts < quotaTtlMs) {
      fraction = cached.fraction;
    } else {
      // Try to resolve a live quota fraction; never let a slow usage probe block routing.
      try {
        const conns = await getActiveConnections();
        const conn = conns.find((c) => c.provider === provider && c.isActive !== false);
        if (conn) {
          const { getUsageForProvider } = await import("../services/usage.js");
          const usage = await Promise.race([
            getUsageForProvider(conn).catch(() => null),
            new Promise((res) => setTimeout(() => res(null), 2000)),
          ]);
          fraction = extractQuotaFraction(usage);
          if (fraction != null) quotaCache[provider] = { fraction, ts: now };
        }
      } catch {
        fraction = null;
      }
    }
    if (fraction != null) {
      for (const c of candidates) {
        if (c.provider === provider) map[`${c.provider}|${c.model}`] = fraction;
      }
    }
  }
  return map;
}

/** Normalize provider usage responses into a 0..1 remaining-quota fraction. */
export function extractQuotaFraction(usage) {
  if (!usage || typeof usage !== "object") return null;
  // Common shapes: { used, total } / { usedPct } / { remaining } / { quota: {used,total} }
  const q = usage.quota || usage;
  const used = Number(q.used ?? q.usedTokens ?? q.totalUsed ?? NaN);
  const total = Number(q.total ?? q.totalTokens ?? q.limit ?? NaN);
  if (Number.isFinite(total) && total > 0) {
    return clamp01((total - (Number.isFinite(used) ? used : 0)) / total);
  }
  const usedPct = Number(q.usedPct ?? q.usedPercent ?? q.percentage ?? NaN);
  if (Number.isFinite(usedPct)) return clamp01(1 - usedPct / 100);
  if (Number.isFinite(used) && used >= 0) return 0.5; // known-but-incomplete → neutral
  return null;
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

/**
 * Append detected local runtime models to the candidate pool (Local-First).
 * Only active when localFirst.enabled. Fail-open: probing errors just add nothing.
 * @param {Array<{provider: string, model: string}>} pool
 * @param {Set<string>} requiredCaps
 * @param {object} localFirst - settings.localFirst
 * @param {object} options
 * @returns {Promise<Array>} the (possibly augmented) pool
 */
export async function appendLocalCandidates(pool, requiredCaps, localFirst = {}, options = {}) {
  if (!localFirst?.enabled) return pool;
  const runtimes = localFirst.runtimes || ["ollama", "lm-studio", "llamacpp"];
  try {
    const { detectLocalRuntimes } = await import("../local/detector.js");
    const found = await detectLocalRuntimes({
      runtimes,
      timeoutMs: options.probeTimeoutMs || localFirst.probeTimeoutMs || 1500,
    });
    const seen = new Set(pool.map((c) => `${c.provider}|${c.model}`));
    const out = [...pool];
    for (const rt of found) {
      if (!rt.running || !rt.provider) continue;
      for (const model of rt.models) {
        if (!model) continue;
        const key = `${rt.provider}|${model}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ provider: rt.provider, model });
      }
    }
    return out;
  } catch {
    return pool;
  }
}

/**
 * Build a ranked candidate list for a request.
 * @param {object} opts
 * @param {object} opts.body - client request (for capability detection)
 * @param {string} opts.taskType
 * @param {Set<string>} [opts.requiredCaps]
 * @param {number} [opts.maxCandidates]
 * @param {object} [opts.weights]
 * @param {object} [opts.quotaCache]
 * @param {object} [opts.localFirst] - settings.localFirst (Local-First mode)
 * @returns {Promise<{ candidates: Array<{provider, model, score, factors, diagnostics}> }>}
 */
export async function selectModels({ body, taskType, requiredCaps, maxCandidates = DEFAULT_MAX_CANDIDATES, weights, quotaCache = {}, localFirst = null }) {
  let caps = requiredCaps;
  if (!caps || caps.size === 0) {
    try {
      const { detectRequiredCapabilities } = await import("../services/combo.js");
      caps = detectRequiredCapabilities(body);
    } catch {
      caps = new Set();
    }
  }

  const connections = await getActiveConnections();
  const remotePool = buildCandidatePool(connections, caps);
  let pool = remotePool;
  if (localFirst?.enabled) {
    pool = await appendLocalCandidates(remotePool, caps, localFirst);
  }
  if (pool.length === 0) return { candidates: [] };

  const [statsMap, priceMap] = await Promise.all([
    getStatsMap(taskType),
    buildPriceMap(pool),
  ]);
  const quotaMap = await buildQuotaMap(pool, quotaCache).catch(() => ({}));

  const ranked = rankCandidates(pool, {
    taskType,
    weights,
    statsMap,
    priceMap,
    quotaMap,
  });

  return { candidates: ranked.slice(0, maxCandidates) };
}
