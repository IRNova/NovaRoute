/**
 * Adaptive Circuit Breaker — prevents cascading failures
 * States: closed → open → half_open → closed
 * Modeled after OmniRoute's adaptiveCircuit.ts
 */

export const CircuitState = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open',
};

/**
 * Create a new circuit breaker
 */
export function createCircuit(options = {}) {
  return {
    state: CircuitState.CLOSED,
    failureCount: 0,
    successCount: 0,
    consecutiveSuccesses: 0,
    lastFailureAt: null,
    openedAt: null,
    halfOpenAt: null,
    nextProbeAt: null,
    reason: null,
    // Config
    failureThreshold: options.failureThreshold ?? 3,
    cooldownMs: options.cooldownMs ?? 60_000,
    halfOpenMaxAttempts: options.halfOpenMaxAttempts ?? 1,
    successThreshold: options.successThreshold ?? 2,
    backoffMultiplier: options.backoffMultiplier ?? 1.5,
  };
}

/**
 * Observe a circuit event (failure, success, probe)
 */
export function observeCircuit(circuit, event, options = {}) {
  const now = options.now ?? new Date();
  const next = { ...circuit };

  switch (event) {
    case 'failure':
      return _handleFailure(next, now, options);

    case 'success':
      return _handleSuccess(next, now, options);

    case 'probe':
      return _handleProbe(next, now);

    default:
      return next;
  }
}

function _handleFailure(circuit, now, options) {
  const reason = options.reason ?? 'request_failed';
  circuit.failureCount += 1;
  circuit.successCount = 0;
  circuit.consecutiveSuccesses = 0;
  circuit.lastFailureAt = now.toISOString();
  circuit.reason = reason;

  const threshold = circuit.failureThreshold;

  if (circuit.state === CircuitState.HALF_OPEN) {
    // Failure during half-open → back to open
    circuit.state = CircuitState.OPEN;
    circuit.openedAt = now.toISOString();
    const cooldown = circuit.cooldownMs * Math.pow(circuit.backoffMultiplier, circuit.failureCount - threshold);
    circuit.nextProbeAt = new Date(now.getTime() + Math.min(cooldown, 300_000)).toISOString();
    circuit.halfOpenAt = null;
  } else if (circuit.failureCount >= threshold) {
    // Enough failures → open the circuit
    circuit.state = CircuitState.OPEN;
    circuit.openedAt = now.toISOString();
    const cooldown = circuit.cooldownMs * Math.pow(circuit.backoffMultiplier, circuit.failureCount - threshold);
    circuit.nextProbeAt = new Date(now.getTime() + Math.min(cooldown, 300_000)).toISOString();
  }

  return circuit;
}

function _handleSuccess(circuit, now, _options) {
  circuit.successCount += 1;
  circuit.consecutiveSuccesses += 1;
  circuit.failureCount = Math.max(0, circuit.failureCount - 1);

  if (circuit.state === CircuitState.HALF_OPEN) {
    if (circuit.consecutiveSuccesses >= circuit.successThreshold) {
      // Enough successes in half-open → close the circuit
      circuit.state = CircuitState.CLOSED;
      circuit.openedAt = null;
      circuit.halfOpenAt = null;
      circuit.nextProbeAt = null;
      circuit.reason = null;
    }
  } else if (circuit.state === CircuitState.CLOSED && circuit.failureCount === 0) {
    // Healthy — reset
    circuit.consecutiveSuccesses = 0;
  }

  return circuit;
}

function _handleProbe(circuit, now) {
  if (circuit.state !== CircuitState.OPEN) return circuit;
  if (!circuit.nextProbeAt || now >= new Date(circuit.nextProbeAt)) {
    circuit.state = CircuitState.HALF_OPEN;
    circuit.halfOpenAt = now.toISOString();
    circuit.consecutiveSuccesses = 0;
  }
  return circuit;
}

/**
 * Check if a request should be allowed
 */
export function shouldAllowRequest(circuit, now = new Date()) {
  if (circuit.state === CircuitState.CLOSED) return true;
  if (circuit.state === CircuitState.HALF_OPEN) return true;

  // OPEN state — check if cooldown has elapsed
  if (circuit.state === CircuitState.OPEN && circuit.nextProbeAt) {
    if (now >= new Date(circuit.nextProbeAt)) {
      return true; // Allow probe
    }
  }

  return false;
}

/**
 * Get circuit health status
 */
export function getCircuitHealth(circuit) {
  return {
    state: circuit.state,
    failureCount: circuit.failureCount,
    isHealthy: circuit.state === CircuitState.CLOSED && circuit.failureCount === 0,
    isDegraded: circuit.state === CircuitState.HALF_OPEN,
    isDown: circuit.state === CircuitState.OPEN,
    lastFailure: circuit.lastFailureAt,
    nextProbe: circuit.nextProbeAt,
    reason: circuit.reason,
  };
}
