/**
 * Combo ordering strategies for the routing engine.
 *
 * Extends the legacy fallback / round-robin rotation with data-driven and
 * stochastic orderings so a combo can route by cost, latency, reliability,
 * context headroom, or a learned score — without new dependencies.
 *
 * Strategy ids (mirrored in src/shared/constants/comboStrategies.js):
 *   fallback, round-robin, fill-first, weighted, random, strict-random,
 *   least-used, lkgp, p2c, cost-optimized, headroom, context-optimized, auto
 *
 * Round-robin below reproduces the legacy rotation semantics exactly (the
 * legacy getRotatedModels in combo.js is left untouched for compat/tests).
 *
 * Fail-open everywhere: any telemetry/pricing/DB hiccup degrades to a neutral
 * ordering instead of throwing out of the hot path.
 */

import { detectTaskType } from "../routing/taskDetector.js";
import { getStatsMap, recordRequest, recordFailure } from "../routing/predictor.js";
import { rankCandidates } from "../routing/scorer.js";
import { getPricingForModel } from "../providers/pricing.js";
import { getCapabilitiesForModel } from "../providers/capabilities.js";

const DEFAULT_CONTEXT_WINDOW = 200000;
const DEFAULT_LATENCY_MS = 1500;
const CHARS_PER_TOKEN = 4;

/** @type {Map<string, { index: number, consecutiveUseCount: number }>} */
const rotationState = new Map();
/** @type {Map<string, { model: string, remaining: number }>} weighted sticky picks */
const weightedStickyState = new Map();
/** @type {Map<string, { calls: number, failures: number, totalLatencyMs: number, lastUsed: number }>} */
const usageState = new Map();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function parseModelRef(modelStr) {
  const str = String(modelStr || "");
  const slash = str.indexOf("/");
  if (slash > 0) return { provider: str.slice(0, slash), model: str.slice(slash + 1) };
  return { provider: "", model: str };
}

// Stable sort: keeps original order for equal keys (Array.sort is stable in
// modern engines, but we make the intent explicit for clarity).
function stableSort(arr, cmp) {
  return arr
    .map((item, i) => ({ item, i }))
    .sort((a, b) => cmp(a.item, b.item) || a.i - b.i)
    .map((x) => x.item);
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clampInt(value, def, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function estimateInputTokens(body) {
  if (!body || typeof body !== "object") return 0;
  try {
    const len = JSON.stringify(body).length;
    return Math.max(1, Math.round(len / CHARS_PER_TOKEN));
  } catch {
    return 0;
  }
}

function contextWindowOf(modelStr) {
  const { provider, model } = parseModelRef(modelStr);
  const caps = getCapabilitiesForModel(provider, model);
  const window = Number(caps?.contextWindow);
  return Number.isFinite(window) && window > 0 ? window : DEFAULT_CONTEXT_WINDOW;
}

function resolveTaskType(context) {
  if (context?.taskType) return context.taskType;
  try {
    const detected = detectTaskType(context?.body || {});
    return detected?.type || detected || "general";
  } catch {
    return "general";
  }
}

/**
 * Per-model price ($/1M input). Prefers the user's DB overrides (pricingRepo),
 * falls back to the static built-in table. Never throws.
 */
async function resolveInputPrice(modelStr) {
  const { provider, model } = parseModelRef(modelStr);
  try {
    const { getPricingForModel: resolveRepo } = await import("../../src/lib/db/repos/pricingRepo.js");
    const repoPrice = await resolveRepo(provider, model);
    const input = repoPrice && Number(repoPrice.input);
    if (Number.isFinite(input) && input > 0) return input;
  } catch {
    /* DB layer unavailable — use static table */
  }
  const price = getPricingForModel(provider, model);
  const input = price && Number(price.input);
  return Number.isFinite(input) && input > 0 ? input : null;
}

// ---------------------------------------------------------------------------
// telemetry
// ---------------------------------------------------------------------------

/**
 * Load per-model telemetry for the given combo models.
 * routingStats (persisted) wins; the in-memory mirror only fills gaps (e.g.
 * standalone/test usage with no DB). Fail-open → all entries null.
 * @returns {Promise<Map<string, object|null>>}
 */
async function loadModelStats(models, context) {
  const out = new Map();
  for (const m of models) out.set(m, null);
  const taskType = resolveTaskType(context);
  try {
    const map = await getStatsMap(taskType);
    for (const m of models) {
      const { provider, model } = parseModelRef(m);
      const stat = map[`${provider}|${model}`] || map[model];
      if (stat) out.set(m, stat);
    }
  } catch {
    /* fail-open */
  }
  for (const m of models) {
    const u = usageState.get(m);
    if (u && !out.get(m)) {
      out.set(m, {
        samples: u.calls,
        successRate: u.calls > 0 ? 1 - u.failures / u.calls : 0,
        avgLatencyMs: u.calls > 0 ? u.totalLatencyMs / u.calls : 0,
        lastUsed: u.lastUsed ? new Date(u.lastUsed).toISOString() : null,
      });
    }
  }
  return out;
}

/**
 * Record one combo target attempt into the telemetry layer. This feeds the
 * data-driven strategies (least-used, lkgp, p2c, auto) over time. Fail-open:
 * never throws.
 */
export async function recordComboTargetResult({ modelStr, ok = true, latencyMs = 0, taskType = null }) {
  const { provider, model } = parseModelRef(modelStr);
  if (!provider || !model) return;
  const u = usageState.get(modelStr) || { calls: 0, failures: 0, totalLatencyMs: 0, lastUsed: 0 };
  u.calls += 1;
  if (!ok) u.failures += 1;
  u.totalLatencyMs += latencyMs || 0;
  u.lastUsed = Date.now();
  usageState.set(modelStr, u);
  try {
    if (ok) {
      await recordRequest({ taskType, provider, model, success: true, latencyMs: latencyMs || 0 });
    } else {
      await recordFailure({ taskType, provider, model, latencyMs: latencyMs || 0 });
    }
  } catch {
    /* fail-open */
  }
}

/** Clear in-memory order state for a combo (or all when comboName is omitted). */
export function resetComboOrderState(comboName) {
  const resetOne = (map) => {
    if (comboName) map.delete(comboName);
    else map.clear();
  };
  resetOne(rotationState);
  resetOne(weightedStickyState);
  if (!comboName) usageState.clear();
}

// ---------------------------------------------------------------------------
// ordering strategies
// ---------------------------------------------------------------------------

function rotateFromIndex(models, currentIndex) {
  const rotated = [...models];
  for (let i = 0; i < currentIndex; i++) {
    const moved = rotated.shift();
    rotated.push(moved);
  }
  return rotated;
}

// Legacy-compatible round-robin: advance the rotation index after stickyLimit
// consecutive uses of a model. Also backs the fill-first strategy (which is the
// same rotation driven by a per-model "requests per bucket" count).
function roundRobinOrder(models, comboName, stickyLimit) {
  const rotationKey = comboName || "__default__";
  const normalizedStickyLimit = clampInt(stickyLimit, 1, 1, 100000);
  const state = rotationState.get(rotationKey) || { index: 0, consecutiveUseCount: 0 };
  const currentIndex = state.index % models.length;
  const rotated = rotateFromIndex(models, currentIndex);
  const nextUseCount = state.consecutiveUseCount + 1;

  if (nextUseCount >= normalizedStickyLimit) {
    rotationState.set(rotationKey, {
      index: (currentIndex + 1) % models.length,
      consecutiveUseCount: 0,
    });
  } else {
    rotationState.set(rotationKey, {
      index: currentIndex,
      consecutiveUseCount: nextUseCount,
    });
  }
  return rotated;
}

/**
 * Normalize per-model weights from config. Accepts:
 *   weights: { "provider/model": 2, "bare-model": 1 }
 *   weights: [{ model, weight }, ...] or [{ "provider/model": 3 }, ...]
 *   modelWeights: same shapes as weights
 * Returns { [modelString]: number } or null when nothing usable.
 */
function resolveWeights(models, config) {
  if (!config || typeof config !== "object") return null;
  let raw = config.weights ?? config.modelWeights;
  if (Array.isArray(raw)) {
    const m = {};
    for (const item of raw) {
      if (!item) continue;
      if (typeof item === "string") {
        const [mm, ww] = String(item).split(/[=:]/);
        if (mm && ww != null) m[mm.trim()] = Number(ww);
      } else if (typeof item === "object") {
        if (item.model != null && item.weight != null) m[String(item.model)] = Number(item.weight);
        else for (const [k, v] of Object.entries(item)) m[k] = Number(v);
      }
    }
    raw = m;
  }
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const key of Object.keys(raw)) {
    const v = Number(raw[key]);
    if (!Number.isFinite(v) || v < 0) continue;
    for (const m of models) {
      if (m === key || parseModelRef(m).model === key) out[m] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function weightedOrder(models, comboName, config) {
  const weights = resolveWeights(models, config);
  if (!weights) {
    // No weights → random first, remaining in configured order.
    const first = models[Math.floor(Math.random() * models.length)];
    return [first, ...models.filter((m) => m !== first)];
  }

  const entries = models.map((m) => ({ m, w: Math.max(0, weights[m] ?? 0) }));
  const total = entries.reduce((sum, e) => sum + e.w, 0);
  if (total <= 0) {
    const first = models[Math.floor(Math.random() * models.length)];
    return [first, ...models.filter((m) => m !== first)];
  }

  const stickyLimit = clampInt(config.requestsPerModel, 1, 1, 100000);
  const key = comboName || "__default__";
  const sticky = weightedStickyState.get(key);
  let first;
  if (sticky && sticky.remaining > 0 && models.includes(sticky.model)) {
    first = sticky.model;
    sticky.remaining -= 1;
    weightedStickyState.set(key, sticky);
  } else {
    let r = Math.random() * total;
    let picked = entries[0].m;
    for (const e of entries) {
      r -= e.w;
      if (r <= 0) {
        picked = e.m;
        break;
      }
    }
    first = picked;
    weightedStickyState.set(key, { model: first, remaining: stickyLimit - 1 });
  }

  const rest = stableSort(entries.filter((e) => e.m !== first), (a, b) => b.w - a.w).map((e) => e.m);
  return [first, ...rest];
}

async function leastUsedOrder(models, context) {
  const stats = await loadModelStats(models, context);
  return stableSort(models, (a, b) => {
    const sa = stats.get(a) || {};
    const sb = stats.get(b) || {};
    const ca = sa.samples || 0;
    const cb = sb.samples || 0;
    if (ca !== cb) return ca - cb;
    const la = sa.lastUsed ? Date.parse(sa.lastUsed) || 0 : 0;
    const lb = sb.lastUsed ? Date.parse(sb.lastUsed) || 0 : 0;
    return la - lb;
  });
}

// Least recently used, then fastest (latency tie-break among equally-cold models).
async function lkgpOrder(models, context) {
  const stats = await loadModelStats(models, context);
  return stableSort(models, (a, b) => {
    const sa = stats.get(a) || {};
    const sb = stats.get(b) || {};
    const la = sa.lastUsed ? Date.parse(sa.lastUsed) || 0 : 0;
    const lb = sb.lastUsed ? Date.parse(sb.lastUsed) || 0 : 0;
    if (la !== lb) return la - lb;
    const latencyA = sa.avgLatencyMs > 0 ? sa.avgLatencyMs : DEFAULT_LATENCY_MS;
    const latencyB = sb.avgLatencyMs > 0 ? sb.avgLatencyMs : DEFAULT_LATENCY_MS;
    return latencyA - latencyB;
  });
}

// Power of two choices on predicted latency: sample two candidates, let the
// faster one lead; the rest keep their configured order.
async function p2cOrder(models, context) {
  if (models.length < 2) return models;
  const stats = await loadModelStats(models, context);
  const firstIdx = Math.floor(Math.random() * models.length);
  let secondIdx = Math.floor(Math.random() * (models.length - 1));
  if (secondIdx >= firstIdx) secondIdx += 1;
  const predict = (m) => {
    const s = stats.get(m);
    return s?.avgLatencyMs > 0 ? s.avgLatencyMs : DEFAULT_LATENCY_MS;
  };
  const a = models[firstIdx];
  const b = models[secondIdx];
  const first = predict(a) <= predict(b) ? a : b;
  return [first, ...models.filter((m) => m !== first)];
}

async function costOptimizedOrder(models) {
  const priced = [];
  const unknown = [];
  for (const m of models) {
    const input = await resolveInputPrice(m);
    if (input == null) unknown.push(m);
    else priced.push({ m, input });
  }
  const ordered = stableSort(priced, (x, y) => x.input - y.input).map((x) => x.m);
  return [...ordered, ...unknown];
}

function headroomOrder(models, context) {
  const estimated = estimateInputTokens(context.body);
  return stableSort(
    models,
    (a, b) =>
      Math.max(0, contextWindowOf(b) - estimated) - Math.max(0, contextWindowOf(a) - estimated)
  );
}

function contextOptimizedOrder(models) {
  return stableSort(models, (a, b) => contextWindowOf(b) - contextWindowOf(a));
}

// Learned 4-factor scoring (cost/latency/quality/quota) — reuses the adaptive
// routing scorer. Unknown signals are neutral (0.5), so a cold combo keeps its
// configured order. Weights overridable per-combo via config.autoWeights.
async function autoOrder(models, config, context) {
  const taskType = resolveTaskType(context);
  const byKey = new Map(
    models.map((m) => {
      const { provider, model } = parseModelRef(m);
      return [`${provider}/${model}`, m];
    })
  );
  const pool = [...byKey.keys()].map((key) => {
    const slash = key.indexOf("/");
    return { provider: key.slice(0, slash), model: key.slice(slash + 1) };
  });

  let statsMap = {};
  try {
    statsMap = await getStatsMap(taskType);
  } catch {
    /* fail-open */
  }
  const priceMap = {};
  for (const p of pool) {
    const price = await resolveInputPrice(`${p.provider}/${p.model}`);
    if (price != null) priceMap[`${p.provider}|${p.model}`] = price;
  }
  const weights = config?.autoWeights || undefined;
  try {
    const ranked = rankCandidates(pool, { taskType, weights, statsMap, priceMap });
    return ranked.map((r) => byKey.get(`${r.provider}/${r.model}`)).filter(Boolean);
  } catch {
    return models;
  }
}

/**
 * Resolve the execution order for a combo under the given strategy.
 * Never mutates `models`; never throws; unknown strategies degrade to `models`.
 *
 * @param {object} params
 * @param {string[]} params.models - Combo model strings ("provider/model").
 * @param {string} [params.comboName] - Combo name (rotation/usage state key).
 * @param {string} [params.strategy] - Strategy id (see header list).
 * @param {object} [params.config] - Per-combo strategy config from settings.
 * @param {object} [params.context] - { body, taskType } for size/stats-aware strategies.
 * @returns {Promise<string[]>} Ordered models (async for data-driven strategies).
 */
export async function orderComboModels({ models, comboName, strategy, config = {}, context = {} }) {
  const list = Array.isArray(models) ? models.filter(Boolean) : [];
  if (list.length <= 1) return list;
  const s = strategy || "fallback";

  switch (s) {
    case "round-robin":
      return roundRobinOrder(list, comboName, config.stickyLimit ?? 1);
    case "fill-first":
      return roundRobinOrder(list, comboName, config.requestsPerModel ?? 1);
    case "weighted":
      return weightedOrder(list, comboName, config);
    case "random":
    case "strict-random":
      return shuffle(list);
    case "least-used":
      return leastUsedOrder(list, context);
    case "lkgp":
      return lkgpOrder(list, context);
    case "p2c":
      return p2cOrder(list, context);
    case "cost-optimized":
      return costOptimizedOrder(list);
    case "headroom":
      return headroomOrder(list, context);
    case "context-optimized":
      return contextOptimizedOrder(list);
    case "auto":
      return autoOrder(list, config, context);
    case "fusion":
    case "fallback":
    default:
      return list;
  }
}
