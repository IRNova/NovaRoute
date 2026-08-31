/**
 * Failure Classification — categorizes failures for intelligent routing
 * Different failure types trigger different recovery strategies
 */

export const FailureType = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  AUTH: 'auth',
  QUOTA: 'quota',
  MODEL_ERROR: 'model_error',
  PROVIDER_DOWN: 'provider_down',
  INVALID_REQUEST: 'invalid_request',
  CONTENT_POLICY: 'content_policy',
  UNKNOWN: 'unknown',
};

export const FailureSeverity = {
  TRANSIENT: 'transient',     // Temporary, retry may succeed
  DEGRADED: 'degraded',       // Partial failure, fallback possible
  PERMANENT: 'permanent',     // Won't recover, skip provider
  CRITICAL: 'critical',       // System-level issue, alert needed
};

// ─── Classification Rules ──────────────────────────────────────────────────

const CLASSIFICATION_RULES = [
  // Network errors
  { type: FailureType.NETWORK, severity: FailureSeverity.TRANSIENT,
    patterns: [/ECONNREFUSED/i, /ECONNRESET/i, /ETIMEDOUT/i, /ENOTFOUND/i, /socket hang up/i, /network/i] },

  // Timeout
  { type: FailureType.TIMEOUT, severity: FailureSeverity.TRANSIENT,
    patterns: [/timeout/i, /timed?\s*out/i, /abort/i, /request timeout/i],
    retryable: true },

  // Rate limiting
  { type: FailureType.RATE_LIMIT, severity: FailureSeverity.DEGRADED,
    patterns: [/rate.?limit/i, /429/i, /too many requests/i, /throttl/i],
    retryable: true,
    retryAfterMs: 5000 },

  // Authentication
  { type: FailureType.AUTH, severity: FailureSeverity.PERMANENT,
    patterns: [/unauthorized/i, /401/i, /invalid.?api.?key/i, /authentication/i, /forbidden/i, /403/i],
    retryable: false },

  // Quota
  { type: FailureType.QUOTA, severity: FailureSeverity.PERMANENT,
    patterns: [/quota/i, /exceeded/i, /insufficient.?credit/i, /billing/i, /402/i, /payment/i],
    retryable: false },

  // Model errors
  { type: FailureType.MODEL_ERROR, severity: FailureSeverity.DEGRADED,
    patterns: [/model.?not.?found/i, /invalid.?model/i, /context.?length/i, /max.?tokens/i, /overloaded/i, /503/i, /502/i],
    retryable: true },

  // Provider down
  { type: FailureType.PROVIDER_DOWN, severity: FailureSeverity.CRITICAL,
    patterns: [/service.?unavailable/i, /bad.?gateway/i, /gateway.?timeout/i, /500/i, /502/i, /503/i, /504/i],
    retryable: true },

  // Content policy
  { type: FailureType.CONTENT_POLICY, severity: FailureSeverity.PERMANENT,
    patterns: [/content.?policy/i, /safety/i, /blocked/i, /filtered/i, /nsfw/i, /moderation/i],
    retryable: false },

  // Invalid request
  { type: FailureType.INVALID_REQUEST, severity: FailureSeverity.PERMANENT,
    patterns: [/bad.?request/i, /400/i, /invalid.?request/i, /malformed/i, /schema/i],
    retryable: false },
];

/**
 * Classify a failure from error info
 */
export function classifyFailure(error, statusCode = null) {
  const errorMessage = error?.message ?? String(error);
  const combined = `${errorMessage} ${statusCode ?? ''}`;

  for (const rule of CLASSIFICATION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(combined)) {
        return {
          type: rule.type,
          severity: rule.severity,
          retryable: rule.retryable ?? false,
          retryAfterMs: rule.retryAfterMs ?? null,
          originalError: errorMessage,
          statusCode,
          classifiedAt: new Date().toISOString(),
        };
      }
    }
  }

  // Default: unknown but transient
  return {
    type: FailureType.UNKNOWN,
    severity: FailureSeverity.TRANSIENT,
    retryable: true,
    retryAfterMs: 1000,
    originalError: errorMessage,
    statusCode,
    classifiedAt: new Date().toISOString(),
  };
}

/**
 * Calculate retry delay with exponential backoff + jitter
 */
export function calculateRetryDelay(attempt, classification, options = {}) {
  const baseDelay = options.baseDelayMs ?? 1000;
  const maxDelay = options.maxDelayMs ?? 30_000;
  const jitterRange = options.jitterMs ?? 500;

  let delay = classification.retryAfterMs ?? baseDelay;
  delay = delay * Math.pow(2, attempt);
  delay = Math.min(delay, maxDelay);

  // Add jitter
  delay += (Math.random() - 0.5) * jitterRange;

  return Math.max(0, Math.round(delay));
}

/**
 * Build a failure summary from multiple classifications
 */
export function buildFailureSummary(classifications) {
  const byType = {};
  const bySeverity = { transient: 0, degraded: 0, permanent: 0, critical: 0 };

  for (const c of classifications) {
    byType[c.type] = (byType[c.type] || 0) + 1;
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
  }

  return {
    total: classifications.length,
    byType,
    bySeverity,
    retryableCount: classifications.filter(c => c.retryable).length,
    permanentCount: classifications.filter(c => c.severity === FailureSeverity.PERMANENT).length,
  };
}
