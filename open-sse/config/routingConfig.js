// Adaptive routing constants — single source for the routing module.
// Keep everything here; routing modules never hardcode thresholds.

// Task types used by taskDetector + predictor (routingStats key).
export const TASK_TYPES = {
  CODING: "coding",
  REFACTOR: "refactor",
  DEBUG: "debug",
  EXPLANATION: "explanation",
  TRANSLATION: "translation",
  AGENTIC: "agentic",
  CREATIVE: "creative",
  ANALYSIS: "analysis",
  DATA: "data",
  SIMPLE: "simple",
  GENERAL: "general",
};

// Default task labels (Persian UI-friendly names live in the dashboard i18n).
export const TASK_LABELS = {
  coding: "کدنویسی",
  refactor: "ریفکتور",
  debug: "دیباگ",
  explanation: "توضیح",
  agentic: "عاملی",
  creative: "خلاقانه",
  analysis: "تحلیل",
  data: "داده",
  simple: "ساده",
  general: "عمومی",
};

// Default scoring weights for the 4-factor composite (sums to 1).
export const DEFAULT_WEIGHTS = {
  cost: 0.3,
  latency: 0.25,
  quality: 0.3,
  quota: 0.15,
};

// Virtual model names that trigger full smart selection (no explicit target).
export const SMART_MODEL_NAMES = new Set(["smart", "auto", "best", "adaptive", "genius"]);

// Genius Mode: quality-first weights (premium models, cost/latency deprioritized).
export const GENIUS_WEIGHTS = {
  cost: 0.1,
  latency: 0.1,
  quality: 0.65,
  quota: 0.15,
};

// Genius Mode: more candidates to hunt for a capable model.
export const GENIUS_MAX_CANDIDATES = 8;

// Cap on how many candidates smart routing will try per request.
export const DEFAULT_MAX_CANDIDATES = 6;

// Cost score normalization: input price (USD / 1M tokens) mapping to 0..1.
// price = COST_SCALE → score 0.5; cheaper → higher score.
export const COST_SCALE = 2.0;

// Latency score normalization: predicted latency above this → score ~0.
export const LATENCY_BASELINE_MS = 20000;

// Minimum samples before historical success-rate dominates the static tier.
export const STATS_MIN_SAMPLES = 5;

// Static quality baseline per model-name pattern (0..1). First match wins.
// Used when history has too few samples. Pattern order matters.
export const MODEL_QUALITY_TIERS = [
  { pattern: "*opus*", quality: 0.96 },
  { pattern: "*o4*", quality: 0.96 },
  { pattern: "*gpt-5*", quality: 0.92 },
  { pattern: "*gpt-oss*", quality: 0.85 },
  { pattern: "*sonnet*", quality: 0.88 },
  { pattern: "*gemini-3.5-flash*", quality: 0.8 },
  { pattern: "*gemini-3-pro*", quality: 0.92 },
  { pattern: "*gemini-*pro*", quality: 0.9 },
  { pattern: "*gemini-*flash*", quality: 0.78 },
  { pattern: "*haiku*", quality: 0.8 },
  { pattern: "*mini*", quality: 0.75 },
  { pattern: "*flash*", quality: 0.75 },
  { pattern: "*deepseek*", quality: 0.82 },
  { pattern: "*kimi*", quality: 0.82 },
  { pattern: "*glm*", quality: 0.8 },
  { pattern: "*qwen*", quality: 0.8 },
  { pattern: "*grok*", quality: 0.82 },
  { pattern: "*llama*", quality: 0.78 },
  { pattern: "*local*", quality: 0.6 },
];

// Static latency baseline per model-name pattern (ms). First match wins.
export const MODEL_LATENCY_TIERS = [
  { pattern: "*opus*", latencyMs: 15000 },
  { pattern: "*o4*", latencyMs: 18000 },
  { pattern: "*gpt-5*", latencyMs: 12000 },
  { pattern: "*sonnet*", latencyMs: 9000 },
  { pattern: "*gemini-*pro*", latencyMs: 8000 },
  { pattern: "*gemini-*flash*", latencyMs: 3500 },
  { pattern: "*haiku*", latencyMs: 4000 },
  { pattern: "*mini*", latencyMs: 5000 },
  { pattern: "*flash*", latencyMs: 4500 },
  { pattern: "*deepseek*", latencyMs: 9000 },
  { pattern: "*kimi*", latencyMs: 9000 },
  { pattern: "*qwen*", latencyMs: 6000 },
  { pattern: "*local*", latencyMs: 2500 },
];

// Task types where the model must be strong (prefer quality over cost).
export const QUALITY_FIRST_TASKS = new Set([
  TASK_TYPES.REFACTOR,
  TASK_TYPES.DEBUG,
  TASK_TYPES.AGENTIC,
  TASK_TYPES.CODING,
]);

// Task types where latency dominates (interactive/simple answers).
export const LATENCY_FIRST_TASKS = new Set([
  TASK_TYPES.SIMPLE,
  TASK_TYPES.EXPLANATION,
  TASK_TYPES.TRANSLATION,
]);

// Task types where the cheapest adequate model wins.
export const COST_FIRST_TASKS = new Set([
  TASK_TYPES.DATA,
  TASK_TYPES.CREATIVE,
  TASK_TYPES.GENERAL,
]);

/**
 * Resolve effective scoring weights for a task type.
 * Task-type bias is layered on top of the user weights: quality-first tasks
 * get +0.1 quality, latency-first tasks +0.15 latency, cost-first +0.1 cost,
 * renormalized to sum to 1.
 */
export function resolveWeightsForTask(taskType, baseWeights = DEFAULT_WEIGHTS) {
  const w = { ...baseWeights };
  if (QUALITY_FIRST_TASKS.has(taskType)) w.quality = (w.quality || 0) + 0.1;
  if (LATENCY_FIRST_TASKS.has(taskType)) w.latency = (w.latency || 0) + 0.15;
  if (COST_FIRST_TASKS.has(taskType)) w.cost = (w.cost || 0) + 0.1;
  const total = Math.max(1e-9, w.cost + w.latency + w.quality + w.quota);
  w.cost /= total;
  w.latency /= total;
  w.quality /= total;
  w.quota /= total;
  return w;
}

/** Simple glob match ("*" wildcard), case-insensitive. Reused across tiers. */
export function matchGlob(pattern, value) {
  const regex = new RegExp(
    "^" + pattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$",
    "i"
  );
  return regex.test(value || "");
}

/** Resolve a static quality baseline for a model id (default 0.6). */
export function staticQualityForModel(model) {
  for (const { pattern, quality } of MODEL_QUALITY_TIERS) {
    if (matchGlob(pattern, model)) return quality;
  }
  return 0.6;
}

/** Resolve a static latency baseline for a model id (default 8000ms). */
export function staticLatencyForModel(model) {
  for (const { pattern, latencyMs } of MODEL_LATENCY_TIERS) {
    if (matchGlob(pattern, model)) return latencyMs;
  }
  return 8000;
}
