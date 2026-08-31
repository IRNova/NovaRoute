// 4-factor model scorer for adaptive routing.
// Composite score = wCost·costScore + wLatency·latencyScore + wQuality·qualityScore + wQuota·quotaScore.
// All factor scores normalized 0..1. Pure & synchronous so it's trivially testable.
import {
  COST_SCALE,
  LATENCY_BASELINE_MS,
  STATS_MIN_SAMPLES,
  resolveWeightsForTask,
  staticQualityForModel,
  staticLatencyForModel,
} from "../config/routingConfig.js";

function clamp01(x) {
  if (!Number.isFinite(x)) return 0.5;
  return Math.min(1, Math.max(0, x));
}

/**
 * Cost score from USD/1M input price. Unknown price → 0.5 (neutral).
 * score = 1 - log1p(price) / log1p(priceMax), priceMax = COST_SCALE.
 */
export function costScoreForPrice(inputPrice) {
  if (inputPrice == null || !Number.isFinite(inputPrice) || inputPrice <= 0) return 0.5;
  return clamp01(1 - Math.log1p(inputPrice) / Math.log1p(COST_SCALE));
}

/**
 * Latency score from predicted ms. Unknown → 0.5. Fast → near 1.
 */
export function latencyScoreForMs(latencyMs) {
  if (latencyMs == null || !Number.isFinite(latencyMs) || latencyMs <= 0) return 0.5;
  return clamp01(1 - latencyMs / LATENCY_BASELINE_MS);
}

/**
 * Quality score = blend of static model tier and learned success rate.
 * Below STATS_MIN_SAMPLES history barely counts; above it history dominates.
 */
export function qualityScore(staticTier, stat) {
  const base = staticTier == null || !Number.isFinite(staticTier) ? 0.6 : staticTier;
  if (!stat || stat.samples < 1) return base;
  const histWeight = Math.min(0.6, stat.samples / (stat.samples + STATS_MIN_SAMPLES));
  return clamp01(base * (1 - histWeight) + (stat.successRate || 0) * histWeight);
}

/**
 * Score a single model.
 * @param {object} params
 * @param {string} params.provider
 * @param {string} params.model
 * @param {string} params.taskType
 * @param {object} [params.weights] - overrides DEFAULT_WEIGHTS
 * @param {object} [params.statsMap] - { "provider|model": {samples, successRate, avgLatencyMs, ...} }
 * @param {object} [params.priceMap] - { "provider|model": inputPrice } (pre-resolved to stay sync)
 * @param {object} [params.quotaMap] - { "provider|model": quotaFraction 0..1 }
 * @returns {{ score: number, factors: {cost, latency, quality, quota}, diagnostics: object }}
 */
export function scoreModel({ provider, model, taskType, weights, statsMap, priceMap, quotaMap }) {
  const w = resolveWeightsForTask(taskType, weights);
  const key = `${provider}|${model}`;
  const stat = statsMap?.[key] || null;

  const costScore = costScoreForPrice(priceMap?.[key]);
  const latencyScore = latencyScoreForMs(
    stat?.samples > 0 ? stat.avgLatencyMs : staticLatencyForModel(model)
  );
  const qualityScoreVal = qualityScore(staticQualityForModel(model), stat);
  const quotaScore = quotaMap?.[key] != null && Number.isFinite(quotaMap[key])
    ? clamp01(quotaMap[key])
    : 0.5;

  const score =
    w.cost * costScore +
    w.latency * latencyScore +
    w.quality * qualityScoreVal +
    w.quota * quotaScore;

  return {
    score: clamp01(score),
    factors: { cost: costScore, latency: latencyScore, quality: qualityScoreVal, quota: quotaScore },
    diagnostics: {
      weights: w,
      stat,
      staticQuality: staticQualityForModel(model),
      staticLatencyMs: staticLatencyForModel(model),
    },
  };
}

/**
 * Score a list of candidates and return them sorted desc by score.
 * @param {Array<{provider: string, model: string}>} candidates
 * @param {object} opts - same maps as scoreModel
 * @returns {Array<{provider, model, score, factors, diagnostics}>}
 */
export function rankCandidates(candidates, opts) {
  const ranked = candidates
    .map((c) => ({ provider: c.provider, model: c.model, ...scoreModel({ ...c, ...opts }) }))
    .sort((a, b) => b.score - a.score);
  return ranked;
}
