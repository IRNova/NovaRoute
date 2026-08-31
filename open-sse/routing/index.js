// Adaptive + Predictive Routing — module entry.
// Wires task detection, prediction, scoring, selection and dynamic fallback.
export { detectTaskType } from "./taskDetector.js";
export {
  recordRequest,
  recordFailure,
  getModelStats,
  getStatsMap,
  getStatsSummary,
  pruneRoutingStats,
} from "./predictor.js";
export {
  scoreModel,
  rankCandidates,
  costScoreForPrice,
  latencyScoreForMs,
  qualityScore,
} from "./scorer.js";
export { selectModels, buildCandidatePool, buildPriceMap, extractQuotaFraction } from "./selector.js";
export { handleAdaptiveFallback, buildAdaptivePlan } from "./adaptiveFallback.js";

import { detectTaskType } from "./taskDetector.js";

/** Convenience: detect task type from a body (re-exported at module level). */
export function detectTask(body) {
  return detectTaskType(body);
}
