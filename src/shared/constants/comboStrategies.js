// Combo routing strategy metadata — pure data, safe for client components.
// The ids must match the strategy set handled by open-sse/services/comboStrategies.js.

export const COMBO_STRATEGIES = [
  {
    id: "fallback",
    label: "Fallback",
    icon: "layers",
    description: "Try models in order; move to the next only on failure.",
    configurable: false,
  },
  {
    id: "round-robin",
    label: "Round Robin",
    icon: "sync_alt",
    description: "Rotate models across requests to spread load evenly.",
    configurable: true,
  },
  {
    id: "fill-first",
    label: "Fill First",
    icon: "playlist_add",
    description: "Use each model for N consecutive requests before moving on.",
    configurable: true,
  },
  {
    id: "weighted",
    label: "Weighted",
    icon: "tune",
    description: "Weighted-random first pick; the rest follow by weight.",
    configurable: true,
  },
  {
    id: "random",
    label: "Random",
    icon: "shuffle",
    description: "Shuffle the execution order on every request.",
    configurable: false,
  },
  {
    id: "strict-random",
    label: "Strict Random",
    icon: "casino",
    description: "Fully random order with no repetition tracking.",
    configurable: false,
  },
  {
    id: "least-used",
    label: "Least Used",
    icon: "trending_down",
    description: "Prefer models used least, then least recently.",
    configurable: false,
  },
  {
    id: "lkgp",
    label: "LKGP",
    icon: "schedule",
    description: "Least recently used, then fastest (latency tie-break).",
    configurable: false,
  },
  {
    id: "p2c",
    label: "Power of Two Choices",
    icon: "compare_arrows",
    description: "Let the lower-latency of two random candidates lead.",
    configurable: false,
  },
  {
    id: "cost-optimized",
    label: "Cost Optimized",
    icon: "savings",
    description: "Cheapest model first, using your configured pricing.",
    configurable: false,
  },
  {
    id: "headroom",
    label: "Headroom",
    icon: "space_dashboard",
    description: "Largest free context window first, based on request size.",
    configurable: false,
  },
  {
    id: "context-optimized",
    label: "Context Optimized",
    icon: "view_agenda",
    description: "Biggest context window first.",
    configurable: false,
  },
  {
    id: "auto",
    label: "Auto",
    icon: "auto_awesome",
    description: "Score models by cost, latency, and reliability, then route.",
    configurable: true,
  },
  {
    id: "fusion",
    label: "Fusion",
    icon: "hub",
    description: "Query all models in parallel; a judge synthesizes the final answer.",
    configurable: true,
  },
];

export const COMBO_STRATEGY_BY_ID = Object.fromEntries(COMBO_STRATEGIES.map((s) => [s.id, s]));
export const COMBO_STRATEGY_IDS = COMBO_STRATEGIES.map((s) => s.id);

// Config fields rendered by the per-strategy panel (subset of the config object
// stored under settings.comboStrategies[name]).
export const COMBO_STRATEGY_CONFIG_FIELDS = {
  "round-robin": ["stickyLimit"],
  "fill-first": ["requestsPerModel"],
  weighted: ["requestsPerModel", "weights"],
  auto: ["autoWeights"],
  fusion: ["judgeModel"],
};
