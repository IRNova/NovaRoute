/**
 * Guardrails Registry — manages and orchestrates all guardrails
 * Executes guardrails in priority order with configurable behaviors
 */

import { PromptInjectionGuardrail } from './promptInjection.js';
import { PIIMaskingGuardrail } from './piiMasker.js';
import { CredentialMaskingGuardrail } from './credentialMasker.js';

export class GuardrailsRegistry {
  constructor(options = {}) {
    this.guardrails = [];
    this.defaultMode = options.defaultMode ?? 'block';
    this.logger = options.logger ?? console;
    this.onDetection = options.onDetection ?? null; // callback for detections
  }

  /**
   * Register a guardrail
   */
  register(guardrail) {
    this.guardrails.push(guardrail);
    this.guardrails.sort((a, b) => b.priority - a.priority);
    return this;
  }

  /**
   * Remove a guardrail by name
   */
  unregister(name) {
    this.guardrails = this.guardrails.filter(g => g.name !== name);
    return this;
  }

  /**
   * Run all guardrails against a context
   */
  async run(context) {
    const results = [];
    let shouldBlock = false;
    let modifiedMessages = context.messages ? [...context.messages] : undefined;

    for (const guardrail of this.guardrails) {
      const ctx = {
        ...context,
        messages: modifiedMessages ?? context.messages,
      };

      const result = await guardrail.check(ctx);
      results.push(result);

      if (result.blocked) {
        shouldBlock = true;
      }

      // Apply message modifications from guardrails
      if (result.modifiedMessages) {
        modifiedMessages = result.modifiedMessages;
      }

      // Fire detection callback
      if (this.onDetection && result.detections?.length > 0) {
        this.onDetection(result);
      }

      // If blocked and mode is block, stop processing
      if (result.blocked && (guardrail.mode === 'block' || this.defaultMode === 'block')) {
        break;
      }
    }

    return {
      blocked: shouldBlock,
      results,
      modifiedMessages,
      detections: results.flatMap(r => r.detections ?? []),
      summary: this._buildSummary(results),
    };
  }

  /**
   * Get all registered guardrails
   */
  list() {
    return this.guardrails.map(g => ({
      name: g.name,
      enabled: g.enabled,
      priority: g.priority,
      mode: g.mode,
    }));
  }

  _buildSummary(results) {
    const detections = results.flatMap(r => r.detections ?? []);
    const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const d of detections) {
      severityCounts[d.severity] = (severityCounts[d.severity] || 0) + 1;
    }

    return {
      totalDetections: detections.length,
      severityCounts,
      guardrailsTriggered: results.filter(r => r.detections?.length > 0).length,
      blocked: results.some(r => r.blocked),
    };
  }
}

/**
 * Create a default guardrails registry with common guardrails
 */
export function createDefaultRegistry(options = {}) {
  const registry = new GuardrailsRegistry(options);

  registry.register(new PromptInjectionGuardrail({
    enabled: options.promptInjection !== false,
    priority: 100,
    mode: options.promptInjectionMode ?? 'block',
    blockThreshold: options.injectionBlockThreshold ?? 'medium',
  }));

  registry.register(new PIIMaskingGuardrail({
    enabled: options.piiMasking !== false,
    priority: 50,
    mode: options.piiMaskingMode ?? 'mask',
    action: options.piiAction ?? 'mask',
  }));

  registry.register(new CredentialMaskingGuardrail({
    enabled: options.credentialMasking !== false,
    priority: 60,
    mode: options.credentialMaskingMode ?? 'mask',
    action: options.credentialAction ?? 'mask',
  }));

  return registry;
}

export { PromptInjectionGuardrail, PIIMaskingGuardrail, CredentialMaskingGuardrail };
