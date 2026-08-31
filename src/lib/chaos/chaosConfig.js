/**
 * Chaos Engineering — Configuration & Rules
 * 
 * Defines chaos experiments that can be injected into the system
 * to test resilience and failure handling.
 */

// ============ Chaos Experiment Types ============

const ChaosExperimentType = {
  // Provider failures
  PROVIDER_LATENCY: 'provider-latency',
  PROVIDER_ERROR: 'provider-error',
  PROVIDER_TIMEOUT: 'provider-timeout',
  PROVIDER_UNAVAILABLE: 'provider-unavailable',

  // Network failures
  NETWORK_PARTITION: 'network-partition',
  DNS_FAILURE: 'dns-failure',
  CONNECTION_RESET: 'connection-reset',

  // Resource exhaustion
  MEMORY_PRESSURE: 'memory-pressure',
  CPU_SPIKE: 'cpu-spike',
  DISK_FULL: 'disk-full',

  // Application failures
  RATE_LIMIT_EXCEEDED: 'rate-limit-exceeded',
  AUTH_FAILURE: 'auth-failure',
  DATABASE_UNAVAILABLE: 'database-unavailable',
  CACHE_CORRUPTION: 'cache-corruption',

  // Streaming failures
  STREAM_INTERRUPTED: 'stream-interrupted',
  SSE_HEARTBEAT_MISS: 'sse-heartbeat-miss',
};

// ============ Severity Levels ============

const ChaosSeverity = {
  LOW: 'low',         // Minor impact, auto-recovered
  MEDIUM: 'medium',   // Noticeable impact, fallback triggered
  HIGH: 'high',       // Significant impact, circuit breaker opens
  CRITICAL: 'critical', // System-wide impact, emergency procedures
};

// ============ Experiment Definitions ============

const CHAOS_EXPERIMENTS = [
  {
    id: 'provider-latency-spike',
    name: 'Provider Latency Spike',
    type: ChaosExperimentType.PROVIDER_LATENCY,
    severity: ChaosSeverity.MEDIUM,
    description: 'Injects artificial latency into provider responses',
    config: {
      delayMs: 5000,
      affectedProviders: ['openai', 'anthropic'],
      duration: 60000,
    },
    expectedBehavior: 'Circuit breaker should open, fallback to alternative provider',
    tags: ['provider', 'latency', 'resilience'],
  },
  {
    id: 'provider-error-injection',
    name: 'Provider Error Injection',
    type: ChaosExperimentType.PROVIDER_ERROR,
    severity: ChaosSeverity.HIGH,
    description: 'Forces provider to return 500/503 errors',
    config: {
      errorCode: 503,
      errorBody: 'Service Temporarily Unavailable',
      affectedProviders: ['openai'],
      duration: 30000,
    },
    expectedBehavior: 'Retry logic + fallback to next provider in combo',
    tags: ['provider', 'error', 'fallback'],
  },
  {
    id: 'provider-timeout',
    name: 'Provider Timeout',
    type: ChaosExperimentType.PROVIDER_TIMEOUT,
    severity: ChaosSeverity.HIGH,
    description: 'Simulates provider timeout (no response)',
    config: {
      timeoutMs: 10000,
      affectedProviders: ['anthropic'],
      duration: 45000,
    },
    expectedBehavior: 'Request timeout + model lockout for failing model',
    tags: ['provider', 'timeout', 'lockout'],
  },
  {
    id: 'network-partition',
    name: 'Network Partition',
    type: ChaosExperimentType.NETWORK_PARTITION,
    severity: ChaosSeverity.CRITICAL,
    description: 'Simulates network partition between services',
    config: {
      affectedEndpoints: ['/v1/chat/completions'],
      duration: 30000,
    },
    expectedBehavior: 'Circuit breaker opens, cached responses served',
    tags: ['network', 'partition', 'critical'],
  },
  {
    id: 'rate-limit-blast',
    name: 'Rate Limit Blast',
    type: ChaosExperimentType.RATE_LIMIT_EXCEEDED,
    severity: ChaosSeverity.MEDIUM,
    description: 'Sends burst of requests exceeding rate limits',
    config: {
      burstSize: 100,
      burstIntervalMs: 100,
      targetEndpoint: '/v1/chat/completions',
    },
    expectedBehavior: 'Rate limiter blocks excess, 429 returned',
    tags: ['rate-limit', 'security', 'load'],
  },
  {
    id: 'memory-pressure',
    name: 'Memory Pressure',
    type: ChaosExperimentType.MEMORY_PRESSURE,
    severity: ChaosSeverity.HIGH,
    description: 'Allocates memory to simulate pressure',
    config: {
      allocationMB: 500,
      duration: 30000,
    },
    expectedBehavior: 'Garbage collection activates, old sessions cleaned',
    tags: ['memory', 'pressure', 'gc'],
  },
  {
    id: 'sse-stream-interrupt',
    name: 'SSE Stream Interrupt',
    type: ChaosExperimentType.STREAM_INTERRUPTED,
    severity: ChaosSeverity.MEDIUM,
    description: 'Interrupts SSE streams mid-response',
    config: {
      interruptAfterChunks: 5,
      affectedPaths: ['/v1/chat/completions'],
    },
    expectedBehavior: 'Client detects disconnect, retries or shows partial response',
    tags: ['streaming', 'sse', 'interruption'],
  },
  {
    id: 'cache-corruption',
    name: 'Cache Corruption',
    type: ChaosExperimentType.CACHE_CORRUPTION,
    severity: ChaosSeverity.HIGH,
    description: 'Corrupts cached responses',
    config: {
      corruptionRate: 0.1, // 10% of cache entries
      duration: 60000,
    },
    expectedBehavior: 'Cache validation detects corruption, falls back to fresh request',
    tags: ['cache', 'corruption', 'validation'],
  },
];

// ============ Chaos Manager ============

class ChaosManager {
  constructor() {
    /** @type {Map<string, ActiveExperiment>} */
    this.activeExperiments = new Map();
    this.history = [];
    this.maxHistory = 1000;
  }

  /**
   * Start a chaos experiment
   * @param {string} experimentId
   * @param {object} overrides - Override experiment config
   * @returns {object}
   */
  startExperiment(experimentId, overrides = {}) {
    const experiment = CHAOS_EXPERIMENTS.find(e => e.id === experimentId);
    if (!experiment) throw new Error(`Experiment not found: ${experimentId}`);

    const active = {
      ...experiment,
      config: { ...experiment.config, ...overrides },
      startedAt: new Date().toISOString(),
      status: 'running',
      events: [],
    };

    this.activeExperiments.set(experimentId, active);

    // Auto-stop after duration
    if (active.config.duration) {
      setTimeout(() => this.stopExperiment(experimentId), active.config.duration);
    }

    this._logHistory('started', active);
    return active;
  }

  /**
   * Stop a chaos experiment
   */
  stopExperiment(experimentId) {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) return;

    experiment.status = 'stopped';
    experiment.stoppedAt = new Date().toISOString();
    this._logHistory('stopped', experiment);
    this.activeExperiments.delete(experimentId);
  }

  /**
   * Check if an experiment is active
   */
  isExperimentActive(experimentId, type) {
    for (const [id, exp] of this.activeExperiments) {
      if (id === experimentId || exp.type === type) return true;
    }
    return false;
  }

  /**
   * Get chaos impact for a provider
   */
  getProviderImpact(providerId) {
    const impacts = [];
    for (const [, exp] of this.activeExperiments) {
      const affected = exp.config.affectedProviders || [];
      if (affected.includes(providerId) || affected.includes('*')) {
        impacts.push({
          type: exp.type,
          severity: exp.severity,
          config: exp.config,
        });
      }
    }
    return impacts;
  }

  /**
   * Should this request be chaos-affected?
   */
  shouldIntercept(request) {
    for (const [, exp] of this.activeExperiments) {
      if (this._matchesRequest(exp, request)) return exp;
    }
    return null;
  }

  _matchesRequest(experiment, request) {
    if (experiment.type === ChaosExperimentType.PROVIDER_LATENCY ||
        experiment.type === ChaosExperimentType.PROVIDER_ERROR ||
        experiment.type === ChaosExperimentType.PROVIDER_TIMEOUT) {
      const provider = request.provider || '';
      return experiment.config.affectedProviders?.includes(provider) ||
             experiment.config.affectedProviders?.includes('*');
    }
    if (experiment.type === ChaosExperimentType.RATE_LIMIT_EXCEEDED) {
      return request.path === experiment.config.targetEndpoint;
    }
    return false;
  }

  /**
   * Get all active experiments
   */
  getActive() {
    return [...this.activeExperiments.values()];
  }

  /**
   * Get experiment history
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Get all available experiments
   */
  getCatalog() {
    return CHAOS_EXPERIMENTS;
  }

  /**
   * Get stats
   */
  stats() {
    return {
      active: this.activeExperiments.size,
      totalHistory: this.history.length,
      byType: Object.values(ChaosExperimentType).reduce((acc, type) => {
        acc[type] = [...this.activeExperiments.values()].filter(e => e.type === type).length;
        return acc;
      }, {}),
    };
  }

  _logHistory(action, experiment) {
    this.history.push({
      action,
      experimentId: experiment.id,
      type: experiment.type,
      severity: experiment.severity,
      timestamp: new Date().toISOString(),
    });
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }
}

// Singleton
let _instance = null;

function getChaosManager() {
  if (!_instance) _instance = new ChaosManager();
  return _instance;
}

module.exports = {
  ChaosExperimentType,
  ChaosSeverity,
  CHAOS_EXPERIMENTS,
  ChaosManager,
  getChaosManager,
};
