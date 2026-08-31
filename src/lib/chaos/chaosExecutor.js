/**
 * Chaos Executor — Applies chaos experiments to requests/responses
 */

const { getChaosManager } = require('./chaosConfig');

class ChaosExecutor {
  constructor() {
    this.manager = getChaosManager();
  }

  /**
   * Intercept a request and apply chaos effects
   * @param {object} request - The incoming request
   * @param {Function} next - Continue to next handler
   * @returns {Promise<object>}
   */
  async intercept(request, next) {
    const experiment = this.manager.shouldIntercept(request);
    if (!experiment) return next(request);

    switch (experiment.type) {
      case 'provider-latency':
        return this._applyLatency(request, next, experiment);
      case 'provider-error':
        return this._applyError(request, experiment);
      case 'provider-timeout':
        return this._applyTimeout(request, next, experiment);
      case 'rate-limit-exceeded':
        return this._applyRateLimit(request, experiment);
      default:
        return next(request);
    }
  }

  /**
   * Apply latency injection
   */
  async _applyLatency(request, next, experiment) {
    const delay = experiment.config.delayMs || 3000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    experiment.events.push({
      type: 'latency-injected',
      delayMs: delay,
      timestamp: new Date().toISOString(),
    });
    
    return next(request);
  }

  /**
   * Apply error injection
   */
  _applyError(request, experiment) {
    const errorCode = experiment.config.errorCode || 503;
    const errorBody = experiment.config.errorBody || 'Chaos: Service Unavailable';
    
    experiment.events.push({
      type: 'error-injected',
      errorCode,
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: errorCode,
      body: { error: errorBody },
      headers: { 'X-Chaos-Experiment': experiment.id },
    };
  }

  /**
   * Apply timeout
   */
  async _applyTimeout(request, next, experiment) {
    const timeout = experiment.config.timeoutMs || 10000;
    
    experiment.events.push({
      type: 'timeout-injected',
      timeoutMs: timeout,
      timestamp: new Date().toISOString(),
    });
    
    // Never resolves — simulates timeout
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Chaos: Request timeout')), timeout);
    });
  }

  /**
   * Apply rate limit
   */
  _applyRateLimit(request, experiment) {
    experiment.events.push({
      type: 'rate-limit-triggered',
      timestamp: new Date().toISOString(),
    });
    
    return {
      status: 429,
      body: {
        error: 'Rate limit exceeded (chaos experiment)',
        retryAfter: 60,
      },
      headers: {
        'Retry-After': '60',
        'X-Chaos-Experiment': experiment.id,
      },
    };
  }

  /**
   * Get chaos status for monitoring
   */
  getStatus() {
    const active = this.manager.getActive();
    return {
      activeExperiments: active.length,
      experiments: active.map(e => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        startedAt: e.startedAt,
        eventCount: e.events.length,
      })),
    };
  }
}

// Singleton
let _instance = null;

function getChaosExecutor() {
  if (!_instance) _instance = new ChaosExecutor();
  return _instance;
}

module.exports = { ChaosExecutor, getChaosExecutor };
