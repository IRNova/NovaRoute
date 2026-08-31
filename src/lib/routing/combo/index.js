/**
 * Combo Routing — 19 routing strategies for multi-model orchestration
 * Modeled after OmniRoute's combo.ts with all public strategies
 */

// ─── Strategy Types ────────────────────────────────────────────────────────

export const StrategyType = {
  PRIORITY: 'priority',
  WEIGHTED: 'weighted',
  ROUND_ROBIN: 'round-robin',
  RANDOM: 'random',
  FILL_FIRST: 'fill-first',
  LEAST_USED: 'least-used',
  COST_OPTIMIZED: 'cost-optimized',
  P2C: 'p2c',            // Power of two choices
  RESET_AWARE: 'reset-aware',
  RESET_WINDOW: 'reset-window',
  HEADROOM: 'headroom',
  STRICT_RANDOM: 'strict-random',
  AUTO: 'auto',
  LKGP: 'lkgp',          // Least Known Good Provider
  CONTEXT_OPTIMIZED: 'context-optimized',
  CACHE_OPTIMIZED: 'cache-optimized',
  CONTEXT_RELAY: 'context-relay',
  FUSION: 'fusion',
  PIPELINE: 'pipeline',
};

// ─── Target Selection ──────────────────────────────────────────────────────

/**
 * Select next target based on strategy
 */
export function selectTarget(targets, strategy, context = {}) {
  if (!targets || targets.length === 0) return null;
  if (targets.length === 1) return targets[0];

  switch (strategy) {
    case StrategyType.PRIORITY:
      return _prioritySelect(targets, context);
    case StrategyType.WEIGHTED:
      return _weightedSelect(targets, context);
    case StrategyType.ROUND_ROBIN:
      return _roundRobinSelect(targets, context);
    case StrategyType.RANDOM:
      return _randomSelect(targets);
    case StrategyType.FILL_FIRST:
      return _fillFirstSelect(targets, context);
    case StrategyType.LEAST_USED:
      return _leastUsedSelect(targets, context);
    case StrategyType.COST_OPTIMIZED:
      return _costOptimizedSelect(targets, context);
    case StrategyType.P2C:
      return _p2cSelect(targets, context);
    case StrategyType.RESET_AWARE:
      return _resetAwareSelect(targets, context);
    case StrategyType.RESET_WINDOW:
      return _resetWindowSelect(targets, context);
    case StrategyType.HEADROOM:
      return _headroomSelect(targets, context);
    case StrategyType.STRICT_RANDOM:
      return _strictRandomSelect(targets);
    case StrategyType.AUTO:
      return _autoSelect(targets, context);
    case StrategyType.LKGP:
      return _lkgpSelect(targets, context);
    case StrategyType.CONTEXT_OPTIMIZED:
      return _contextOptimizedSelect(targets, context);
    case StrategyType.CACHE_OPTIMIZED:
      return _cacheOptimizedSelect(targets, context);
    case StrategyType.CONTEXT_RELAY:
      return _contextRelaySelect(targets, context);
    case StrategyType.FUSION:
      return _fusionSelect(targets, context);
    case StrategyType.PIPELINE:
      return _pipelineSelect(targets, context);
    default:
      return _prioritySelect(targets, context);
  }
}

// ─── Strategy Implementations ──────────────────────────────────────────────

// 1. Priority — select by priority order
function _prioritySelect(targets) {
  return [...targets].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))[0];
}

// 2. Weighted — weighted random selection
function _weightedSelect(targets, context) {
  const weights = targets.map(t => t.weight ?? t.priority ?? 1);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let random = (context.random ?? Math.random)() * totalWeight;

  for (let i = 0; i < targets.length; i++) {
    random -= weights[i];
    if (random <= 0) return targets[i];
  }
  return targets[targets.length - 1];
}

// 3. Round-robin — cycle through targets
function _roundRobinSelect(targets, context) {
  const state = context._roundRobinState ?? { index: 0 };
  const target = targets[state.index % targets.length];
  state.index = (state.index + 1) % targets.length;
  context._roundRobinState = state;
  return target;
}

// 4. Random — pure random
function _randomSelect(targets) {
  return targets[Math.floor(Math.random() * targets.length)];
}

// 5. Fill-first — first target with capacity
function _fillFirstSelect(targets, context) {
  for (const target of targets) {
    const load = context.loadMap?.[target.provider]?.load ?? 0;
    const maxLoad = target.maxConcurrency ?? 100;
    if (load < maxLoad) return target;
  }
  return targets[0]; // fallback
}

// 6. Least-used — lowest load
function _leastUsedSelect(targets, context) {
  return [...targets].sort((a, b) => {
    const loadA = context.loadMap?.[a.provider]?.load ?? 0;
    const loadB = context.loadMap?.[b.provider]?.load ?? 0;
    return loadA - loadB;
  })[0];
}

// 7. Cost-optimized — cheapest option
function _costOptimizedSelect(targets) {
  return [...targets].sort((a, b) => {
    const costA = a.costPerToken ?? a.priority ?? 0;
    const costB = b.costPerToken ?? b.priority ?? 0;
    return costA - costB;
  })[0];
}

// 8. P2C — power of two choices (load-balanced)
function _p2cSelect(targets, context) {
  const loadMap = context.loadMap ?? {};
  const a = targets[Math.floor(Math.random() * targets.length)];
  const b = targets[Math.floor(Math.random() * targets.length)];
  const loadA = loadMap[a.provider]?.load ?? 0;
  const loadB = loadMap[b.provider]?.load ?? 0;
  return loadA <= loadB ? a : b;
}

// 9. Reset-aware — prefer providers whose rate limit recently reset
function _resetAwareSelect(targets, context) {
  const now = Date.now();
  return [...targets].sort((a, b) => {
    const resetA = context.rateLimitState?.[a.provider]?.resetAt ?? 0;
    const resetB = context.rateLimitState?.[b.provider]?.resetAt ?? 0;
    // Prefer recently reset
    const freshnessA = now - resetA;
    const freshnessB = now - resetB;
    return freshnessA - freshnessB;
  })[0];
}

// 10. Reset-window — prefer providers within their rate limit window
function _resetWindowSelect(targets, context) {
  const now = Date.now();
  return targets.find(t => {
    const state = context.rateLimitState?.[t.provider];
    if (!state) return true;
    if (state.remainingRequests > 0) return true;
    return state.resetAt && now >= state.resetAt;
  }) ?? targets[0];
}

// 11. Headroom — prefer providers with most remaining capacity
function _headroomSelect(targets, context) {
  return [...targets].sort((a, b) => {
    const headroomA = (context.headroom?.[a.provider] ?? 100) - (context.loadMap?.[a.provider]?.load ?? 0);
    const headroomB = (context.headroom?.[b.provider] ?? 100) - (context.loadMap?.[b.provider]?.load ?? 0);
    return headroomB - headroomA;
  })[0];
}

// 12. Strict-random — random with strict distribution
function _strictRandomSelect(targets) {
  // Fisher-Yates style
  return targets[Math.floor(Math.random() * targets.length)];
}

// 13. Auto — AI-powered selection based on all factors
function _autoSelect(targets, context) {
  const scored = targets.map(t => ({
    target: t,
    score: _calculateAutoScore(t, context),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].target;
}

function _calculateAutoScore(target, context) {
  let score = 50; // base

  // Health factor
  const health = context.healthMap?.[target.provider]?.score ?? 100;
  score += (health / 100) * 20;

  // Cost factor
  const cost = target.costPerToken ?? 0;
  score -= cost * 1000;

  // Load factor
  const load = context.loadMap?.[target.provider]?.load ?? 0;
  const maxLoad = target.maxConcurrency ?? 100;
  score -= (load / maxLoad) * 15;

  // Latency factor
  const latency = context.latencyMap?.[target.provider]?.p50 ?? 1000;
  score -= Math.log10(latency) * 5;

  // Capability match
  if (context.requiredCapabilities) {
    const caps = target.capabilities ?? [];
    const match = context.requiredCapabilities.filter(c => caps.includes(c)).length;
    score += (match / context.requiredCapabilities.length) * 10;
  }

  return score;
}

// 14. LKGP — Least Known Good Provider
function _lkgpSelect(targets, context) {
  const lastSuccess = context.lastSuccessMap ?? {};
  return [...targets].sort((a, b) => {
    const tsA = lastSuccess[a.provider] ?? 0;
    const tsB = lastSuccess[b.provider] ?? 0;
    return tsB - tsA; // most recently successful first
  })[0];
}

// 15. Context-optimized — pick model best suited for context length
function _contextOptimizedSelect(targets, context) {
  const contextLength = context.contextLength ?? 0;
  return [...targets].sort((a, b) => {
    const maxA = a.maxContextLength ?? 128000;
    const maxB = b.maxContextLength ?? 128000;
    // Prefer models that fit comfortably (not too much headroom wasted)
    const fitA = contextLength <= maxA ? (maxA - contextLength) : Infinity;
    const fitB = contextLength <= maxB ? (maxB - contextLength) : Infinity;
    return fitA - fitB;
  }).find(t => (t.maxContextLength ?? 128000) >= contextLength) ?? targets[0];
}

// 16. Cache-optimized — prefer providers with caching
function _cacheOptimizedSelect(targets) {
  return targets.find(t => t.supportsCaching) ?? targets[0];
}

// 17. Context-relay — relay context between related requests
function _contextRelaySelect(targets, context) {
  const prevProvider = context.lastProvider;
  if (prevProvider) {
    const match = targets.find(t => t.provider === prevProvider);
    if (match) return match;
  }
  return targets[0];
}

// 18. Fusion — fan out to multiple models, synthesize results
function _fusionSelect(targets) {
  // Return all targets for parallel fan-out
  return targets;
}

// 19. Pipeline — sequential execution chain
function _pipelineSelect(targets) {
  // Return all targets for sequential execution
  return targets;
}

// ─── Strategy Scoring ──────────────────────────────────────────────────────

/**
 * Score all targets and return ranked list
 */
export function scoreTargets(targets, strategy, context = {}) {
  const scored = targets.map(t => ({
    target: t,
    score: _scoreTarget(t, strategy, context),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function _scoreTarget(target, strategy, context) {
  switch (strategy) {
    case StrategyType.AUTO:
      return _calculateAutoScore(target, context);
    case StrategyType.COST_OPTIMIZED:
      return -(target.costPerToken ?? 0);
    case StrategyType.HEADROOM: {
      const load = context.loadMap?.[target.provider]?.load ?? 0;
      return (target.maxConcurrency ?? 100) - load;
    }
    case StrategyType.CONTEXT_OPTIMIZED: {
      const cl = context.contextLength ?? 0;
      const max = target.maxContextLength ?? 128000;
      return max >= cl ? (max - cl) : -Infinity;
    }
    default:
      return target.priority ?? 50;
  }
}

// ─── Combo Orchestrator ────────────────────────────────────────────────────

/**
 * Execute a combo strategy across targets
 */
export async function executeCombo(targets, strategy, handler, context = {}) {
  if (strategy === StrategyType.FUSION) {
    return _executeFusion(targets, handler, context);
  }

  if (strategy === StrategyType.PIPELINE) {
    return _executePipeline(targets, handler, context);
  }

  // Single-target strategies
  const target = selectTarget(targets, strategy, context);
  if (!target) throw new Error('No targets available');

  return await handler(target, context);
}

async function _executeFusion(targets, handler, context) {
  const results = await Promise.allSettled(
    targets.map(t => handler(t, context))
  );

  const successful = results
    .map((r, i) => ({ result: r.value, target: targets[i] }))
    .filter((_, i) => results[i].status === 'fulfilled');

  if (successful.length === 0) {
    throw new Error('All fusion targets failed');
  }

  // Synthesize results (basic: take the first successful one)
  // In production, this would use a judge model
  return {
    type: 'fusion',
    primary: successful[0].result,
    alternatives: successful.slice(1).map(s => s.result),
    targetCount: successful.length,
  };
}

async function _executePipeline(targets, handler, context) {
  let result = null;

  for (const target of targets) {
    const input = result ? { ...context, previousResult: result } : context;
    result = await handler(target, input);
  }

  return {
    type: 'pipeline',
    result,
    stepsCompleted: targets.length,
  };
}
