/**
 * Base Guardrail — foundation class for all guardrails
 * Modeled after OmniRoute's guardrail architecture
 */

export class BaseGuardrail {
  constructor(name, options = {}) {
    this.name = name;
    this.enabled = options.enabled !== false;
    this.priority = options.priority ?? 0;
    this.mode = options.mode ?? 'block'; // block | warn | log
    this.logger = options.logger ?? console;
  }

  /**
   * Execute the guardrail check
   * @param {GuardrailContext} context
   * @returns {Promise<GuardrailResult>}
   */
  async check(context) {
    if (!this.enabled) {
      return { blocked: false, guardrail: this.name, reason: 'disabled' };
    }

    try {
      return await this.execute(context);
    } catch (error) {
      this.logger.error(`[Guardrail:${this.name}] Error:`, error.message);
      return {
        blocked: false,
        guardrail: this.name,
        error: error.message,
      };
    }
  }

  /**
   * Override in subclasses to implement actual checking logic
   */
  async execute(context) {
    return { blocked: false, guardrail: this.name };
  }
}

/**
 * @typedef {Object} GuardrailContext
 * @property {string} requestId
 * @property {Array} messages - Chat messages
 * @property {string} provider - Target provider
 * @property {string} model - Target model
 * @property {Object} headers - Request headers
 * @property {string} ip - Client IP
 * @property {string} userId - Authenticated user ID
 */

/**
 * @typedef {Object} GuardrailResult
 * @property {boolean} blocked - Whether the request should be blocked
 * @property {string} guardrail - Name of the guardrail
 * @property {string} [reason] - Human-readable reason
 * @property {string} [severity] - low | medium | high | critical
 * @property {Array} [detections] - List of detections
 * @property {Object} [metadata] - Additional info
 */
