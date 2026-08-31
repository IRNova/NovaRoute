/**
 * Resilience System — public API
 */

export {
  CircuitState,
  createCircuit,
  observeCircuit,
  shouldAllowRequest,
  getCircuitHealth,
} from './adaptiveCircuit.js';

export {
  FailureType,
  FailureSeverity,
  classifyFailure,
  calculateRetryDelay,
  buildFailureSummary,
} from './failureClassification.js';

export {
  ModelLockout,
  getGlobalLockout,
  resetGlobalLockout,
} from './modelLockout.js';
