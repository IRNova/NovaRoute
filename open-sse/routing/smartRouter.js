/**
 * Smart Router - Intelligent provider routing for NovaRoute
 * 
 * Routes requests to the best provider based on:
 * - Cost optimization
 * - Quality optimization
 * - Speed optimization
 * - Availability/health
 * - Usage history
 */

const { EventEmitter } = require("events");

/**
 * Provider Health Tracker
 * Monitors provider health and availability
 */
class ProviderHealthTracker extends EventEmitter {
  constructor() {
    super();
    this.healthData = new Map();
    this.healthCheckInterval = 60000; // 1 minute
    this.healthHistory = new Map();
  }

  /**
   * Record a successful request
   */
  recordSuccess(provider, model, responseTime) {
    const key = `${provider}:${model}`;
    const data = this.healthData.get(key) || {
      successes: 0,
      failures: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
    };
    
    data.successes++;
    data.totalResponseTime += responseTime;
    data.avgResponseTime = data.totalResponseTime / data.successes;
    data.lastSuccess = Date.now();
    data.consecutiveFailures = 0;
    
    this.healthData.set(key, data);
    this._updateHealth(key);
  }

  /**
   * Record a failed request
   */
  recordFailure(provider, model, error) {
    const key = `${provider}:${model}`;
    const data = this.healthData.get(key) || {
      successes: 0,
      failures: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
    };
    
    data.failures++;
    data.lastFailure = Date.now();
    data.consecutiveFailures++;
    
    this.healthData.set(key, data);
    this._updateHealth(key);
  }

  /**
   * Get health score for a provider/model
   */
  getHealthScore(provider, model) {
    const key = `${provider}:${model}`;
    const data = this.healthData.get(key);
    
    if (!data || data.successes + data.failures === 0) {
      return 0.5; // Unknown = neutral
    }
    
    const successRate = data.successes / (data.successes + data.failures);
    const recentPenalty = data.consecutiveFailures > 3 ? 0.2 : 0;
    
    return Math.max(0, successRate - recentPenalty);
  }

  /**
   * Check if provider is available
   */
  isAvailable(provider, model) {
    const key = `${provider}:${model}`;
    const data = this.healthData.get(key);
    
    if (!data) return true; // Unknown = available
    
    // Unavailable if too many consecutive failures
    if (data.consecutiveFailures >= 5) {
      return false;
    }
    
    // Unavailable if last failure was recent (within 1 minute)
    if (data.lastFailure && Date.now() - data.lastFailure < 60000) {
      return false;
    }
    
    return true;
  }

  /**
   * Update health status
   */
  _updateHealth(key) {
    const data = this.healthData.get(key);
    if (!data) return;
    
    const health = {
      key,
      score: this.getHealthScore(...key.split(":")),
      available: this.isAvailable(...key.split(":")),
      ...data,
    };
    
    this.emit("health:updated", health);
  }
}

/**
 * Cost Tracker
 * Tracks and estimates costs for different providers/models
 */
class CostTracker {
  constructor() {
    this.costData = new Map();
    this.pricingData = new Map();
  }

  /**
   * Set pricing for a provider/model
   */
  setPricing(provider, model, pricing) {
    const key = `${provider}:${model}`;
    this.pricingData.set(key, {
      inputPerToken: pricing.inputPerToken || 0,
      outputPerToken: pricing.outputPerToken || 0,
      currency: pricing.currency || "USD",
      ...pricing,
    });
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(provider, model, inputTokens, outputTokens) {
    const key = `${provider}:${model}`;
    const pricing = this.pricingData.get(key);
    
    if (!pricing) {
      return null; // Unknown pricing
    }
    
    const inputCost = inputTokens * pricing.inputPerToken;
    const outputCost = outputTokens * pricing.outputPerToken;
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: pricing.currency,
    };
  }

  /**
   * Record actual cost
   */
  recordCost(provider, model, inputTokens, outputTokens, actualCost) {
    const key = `${provider}:${model}`;
    const data = this.costData.get(key) || {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
    };
    
    data.totalRequests++;
    data.totalInputTokens += inputTokens;
    data.totalOutputTokens += outputTokens;
    data.totalCost += actualCost;
    
    this.costData.set(key, data);
  }

  /**
   * Get average cost per request
   */
  getAvgCostPerRequest(provider, model) {
    const key = `${provider}:${model}`;
    const data = this.costData.get(key);
    
    if (!data || data.totalRequests === 0) {
      return null;
    }
    
    return data.totalCost / data.totalRequests;
  }
}

/**
 * Smart Router
 * Routes requests to the best provider based on multiple factors
 */
class SmartRouter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.healthTracker = options.healthTracker || new ProviderHealthTracker();
    this.costTracker = options.costTracker || new CostTracker();
    this.routingStrategy = options.routingStrategy || "balanced"; // balanced, cost, quality, speed
    this.providerRankings = new Map();
    this.routingHistory = [];
    
    // Listen to health updates
    this.healthTracker.on("health:updated", (health) => {
      this._updateRankings(health.key);
    });
  }

  /**
   * Set routing strategy
   */
  setStrategy(strategy) {
    if (!["balanced", "cost", "quality", "speed"].includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
    
    this.routingStrategy = strategy;
    this.emit("strategy:changed", strategy);
  }

  /**
   * Route a request to the best provider
   */
  async route(request, availableProviders) {
    const startTime = Date.now();
    
    // Filter available providers
    const candidates = availableProviders.filter(p => 
      this.healthTracker.isAvailable(p.provider, p.model)
    );
    
    if (candidates.length === 0) {
      throw new Error("No available providers");
    }
    
    // Score each candidate
    const scored = candidates.map(provider => ({
      ...provider,
      score: this._scoreProvider(provider, request),
    }));
    
    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);
    
    // Select best provider
    const selected = scored[0];
    
    // Record routing decision
    this._recordRouting({
      request,
      selected,
      alternatives: scored.slice(1),
      strategy: this.routingStrategy,
      routingTime: Date.now() - startTime,
    });
    
    return selected;
  }

  /**
   * Score a provider for a request
   */
  _scoreProvider(provider, request) {
    const { provider: prov, model } = provider;
    
    // Get health score
    const healthScore = this.healthTracker.getHealthScore(prov, model);
    
    // Get cost score (lower cost = higher score)
    const costEstimate = this.costTracker.estimateCost(
      prov,
      model,
      request.inputTokens || 0,
      request.outputTokens || 0
    );
    const costScore = costEstimate ? 1 - Math.min(costEstimate.totalCost / 10, 1) : 0.5;
    
    // Get quality score (based on model capabilities)
    const qualityScore = this._getQualityScore(model);
    
    // Get speed score (based on response time)
    const speedScore = this._getSpeedScore(prov, model);
    
    // Apply strategy weights
    const weights = this._getStrategyWeights();
    
    const totalScore = 
      healthScore * weights.health +
      costScore * weights.cost +
      qualityScore * weights.quality +
      speedScore * weights.speed;
    
    return totalScore;
  }

  /**
   * Get quality score for a model
   */
  _getQualityScore(model) {
    // Model quality rankings (higher = better)
    const qualityMap = {
      "gpt-4o": 0.95,
      "gpt-4-turbo": 0.9,
      "gpt-4": 0.85,
      "claude-3-5-sonnet": 0.95,
      "claude-3-opus": 0.9,
      "claude-3-sonnet": 0.85,
      "gemini-2.0-flash": 0.9,
      "gemini-1.5-pro": 0.85,
      "deepseek-chat": 0.8,
      // Default for unknown models
    };
    
    return qualityMap[model] || 0.7;
  }

  /**
   * Get speed score for a provider/model
   */
  _getSpeedScore(provider, model) {
    const key = `${provider}:${model}`;
    const data = this.healthTracker.healthData.get(key);
    
    if (!data || data.avgResponseTime === 0) {
      return 0.5; // Unknown
    }
    
    // Lower response time = higher score
    const maxAcceptableTime = 10000; // 10 seconds
    return Math.max(0, 1 - (data.avgResponseTime / maxAcceptableTime));
  }

  /**
   * Get strategy weights
   */
  _getStrategyWeights() {
    const strategies = {
      balanced: {
        health: 0.3,
        cost: 0.25,
        quality: 0.3,
        speed: 0.15,
      },
      cost: {
        health: 0.2,
        cost: 0.5,
        quality: 0.2,
        speed: 0.1,
      },
      quality: {
        health: 0.3,
        cost: 0.1,
        quality: 0.5,
        speed: 0.1,
      },
      speed: {
        health: 0.3,
        cost: 0.1,
        quality: 0.2,
        speed: 0.4,
      },
    };
    
    return strategies[this.routingStrategy] || strategies.balanced;
  }

  /**
   * Update rankings based on health
   */
  _updateRankings(key) {
    const [provider, model] = key.split(":");
    const score = this.healthTracker.getHealthScore(provider, model);
    
    this.providerRankings.set(key, {
      provider,
      model,
      score,
      lastUpdated: Date.now(),
    });
    
    this.emit("rankings:updated", { provider, model, score });
  }

  /**
   * Record routing decision
   */
  _recordRouting(record) {
    this.routingHistory.push({
      ...record,
      timestamp: Date.now(),
    });
    
    // Keep only last 1000 records
    if (this.routingHistory.length > 1000) {
      this.routingHistory = this.routingHistory.slice(-1000);
    }
  }

  /**
   * Get routing statistics
   */
  getStats() {
    const total = this.routingHistory.length;
    const providerCounts = {};
    
    for (const record of this.routingHistory) {
      const provider = record.selected.provider;
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    }
    
    return {
      totalRoutings: total,
      providerCounts,
      currentStrategy: this.routingStrategy,
      rankings: Array.from(this.providerRankings.values()),
    };
  }

  /**
   * Get routing history
   */
  getHistory(limit = 100) {
    return this.routingHistory.slice(-limit);
  }
}

// Singleton instances
let healthTrackerInstance = null;
let costTrackerInstance = null;
let routerInstance = null;

/**
 * Get or create Smart Router instances
 */
function getSmartRouter(options = {}) {
  if (!routerInstance) {
    healthTrackerInstance = options.healthTracker || new ProviderHealthTracker();
    costTrackerInstance = options.costTracker || new CostTracker();
    routerInstance = new SmartRouter({
      healthTracker: healthTrackerInstance,
      costTracker: costTrackerInstance,
      ...options,
    });
  }
  return routerInstance;
}

module.exports = {
  ProviderHealthTracker,
  CostTracker,
  SmartRouter,
  getSmartRouter,
};
