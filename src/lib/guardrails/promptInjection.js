/**
 * Prompt Injection Guardrail — detects and blocks prompt injection attacks
 * Modeled after OmniRoute's promptInjection.ts with full pattern library
 */

import { BaseGuardrail } from './base.js';

// ─── Detection patterns with severity levels ───────────────────────────────
const INJECTION_PATTERNS = [
  // Direct system prompt extraction attempts
  { name: 'system_extraction', pattern: /(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|above|earlier|prior|your)\s+(?:instructions|prompts?|rules?|guidelines?|directives?|system)/i, severity: 'high' },
  { name: 'system_extraction_2', pattern: /(?:show|reveal|display|print|output|repeat|tell me|what are)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?|guidelines?|programming|initial)/i, severity: 'high' },
  { name: 'system_extraction_3', pattern: /(?:what|how)\s+(?:were|are)\s+you\s+(?:told|instructed|programmed|configured|set up)/i, severity: 'medium' },

  // Role hijacking
  { name: 'role_hijack', pattern: /(?:you are now|from now on|act as|pretend to be|roleplay as|simulate being|your new role is|enter(?:ing)?\s+(?:developer|admin|debug|god| DAN)\s+mode)/i, severity: 'high' },
  { name: 'role_hijack_2', pattern: /(?:jailbreak|DAN|do\s+anything\s+now|dev\s+mode|developer\s+mode|god\s+mode|admin\s+mode)/i, severity: 'high' },
  { name: 'role_hijack_3', pattern: /(?:assume\s+(?:you(?:'re| are)|the\s+role)\s+(?:a|an|the)\s+(?:malicious|evil|unrestricted|uncensored))/i, severity: 'high' },

  // Data exfiltration
  { name: 'data_exfil', pattern: /(?:exfiltrate|extract|send|leak|upload|transmit)\s+(?:all\s+)?(?:the\s+)?(?:data|information|secrets?|keys?|tokens?|credentials?|passwords?|api[_\s]?keys?)/i, severity: 'critical' },
  { name: 'data_exfil_2', pattern: /(?:base64|encode|encrypt)\s+(?:and\s+)?(?:send|post|upload|transmit|output)/i, severity: 'high' },

  // SQL/Code injection in prompts
  { name: 'sql_injection', pattern: /(?:';\s*(?:DROP|DELETE|INSERT|UPDATE|ALTER|CREATE)\s|UNION\s+(?:ALL\s+)?SELECT|--\s*$|\/\*[\s\S]*?\*\/)/i, severity: 'high' },
  { name: 'code_injection', pattern: /(?:eval|exec|system|subprocess|os\.popen|child_process|require\s*\(\s*['"]child_process)/i, severity: 'medium' },

  // Token/cost abuse
  { name: 'token_abuse', pattern: /(?:repeat|loop|continue)\s+(?:this|that|the\s+previous|forever|indefinitely|until|∞)/i, severity: 'medium' },
  { name: 'cost_abuse', pattern: /(?:max(?:imum)?\s+tokens?|output\s+(?:all|every|entire)|generate\s+(?:the\s+)?(?:maximum|longest|biggest))/i, severity: 'low' },

  // Separator attacks
  { name: 'separator_attack', pattern: /(?:---+\s*(?:NEW\s+)?(?:INSTRUCTION|SYSTEM|CONTEXT|PROMPT|MESSAGE|INPUT|OUTPUT|RESPONSE|RULE)|###\s*(?:NEW|NEXT|SYSTEM|INSTRUCTION))/i, severity: 'high' },

  // Encoding-based evasion
  { name: 'encoding_evasion', pattern: /(?:rot13|base64|hex\s+decode|url\s+decode|html\s+decode|unicode\s+escape)/i, severity: 'medium' },

  // Multi-language injection
  { name: 'multilang_injection', pattern: /(?:ignorez|ignorer|ignorieren|ignorar|ignorare)\s+(?:toutes?\s+)?(?:les\s+)?(?:instructions|anweisungen|instrucciones|istruzioni)/i, severity: 'high' },

  // Indirect injection via code blocks
  { name: 'indirect_injection', pattern: /\[(?:SYSTEM|INSTRUCTION|RULE|PROMPT)\s*(?:MODE|OVERRIDE|RESET|UPDATE|CHANGE)\]/i, severity: 'high' },
];

// ─── Severity scoring ──────────────────────────────────────────────────────
const SEVERITY_SCORES = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 10,
};

const BLOCK_THRESHOLDS = {
  low: 100,     // never block on low alone
  medium: 8,    // block if cumulative severity >= 8
  high: 4,      // block on single high
  critical: 1,  // always block on critical
};

export class PromptInjectionGuardrail extends BaseGuardrail {
  constructor(options = {}) {
    super('prompt-injection', options);
    this.blockThreshold = options.blockThreshold ?? 'medium';
    this.maxScanBytes = options.maxScanBytes ?? 50_000;
    this.customPatterns = options.customPatterns ?? [];
  }

  async execute(context) {
    const detections = [];
    const messages = context.messages ?? [];

    for (const msg of messages) {
      const text = this._extractText(msg);
      if (!text) continue;

      // Truncate to max scan bytes for performance
      const scanText = text.slice(0, this.maxScanBytes);

      // Check built-in patterns
      for (const pat of INJECTION_PATTERNS) {
        const match = scanText.match(pat.pattern);
        if (match) {
          detections.push({
            name: pat.name,
            match: match[0].slice(0, 100),
            severity: pat.severity,
            score: SEVERITY_SCORES[pat.severity],
            role: msg.role,
          });
        }
      }

      // Check custom patterns
      for (const pat of this.customPatterns) {
        const regex = typeof pat.pattern === 'string' ? new RegExp(pat.pattern, 'i') : pat.pattern;
        const match = scanText.match(regex);
        if (match) {
          detections.push({
            name: pat.name ?? 'custom',
            match: match[0].slice(0, 100),
            severity: pat.severity ?? 'medium',
            score: SEVERITY_SCORES[pat.severity ?? 'medium'],
            role: msg.role,
          });
        }
      }
    }

    // Calculate cumulative score
    const totalScore = detections.reduce((sum, d) => sum + d.score, 0);
    const maxSeverity = this._getMaxSeverity(detections);
    const blocked = this._shouldBlock(totalScore, maxSeverity);

    if (blocked) {
      this.logger.warn(
        `[Guardrail:prompt-injection] BLOCKED — ${detections.length} detections, ` +
        `score=${totalScore}, severity=${maxSeverity}`
      );
    }

    return {
      blocked,
      guardrail: 'prompt-injection',
      severity: maxSeverity,
      detections,
      metadata: {
        totalScore,
        detectionCount: detections.length,
        threshold: this.blockThreshold,
      },
    };
  }

  _extractText(message) {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join('\n');
    }
    return '';
  }

  _getMaxSeverity(detections) {
    if (detections.length === 0) return 'low';
    const order = ['low', 'medium', 'high', 'critical'];
    return detections.reduce((max, d) => {
      return order.indexOf(d.severity) > order.indexOf(max) ? d.severity : max;
    }, 'low');
  }

  _shouldBlock(totalScore, maxSeverity) {
    if (maxSeverity === 'critical') return true;
    const threshold = BLOCK_THRESHOLDS[this.blockThreshold] ?? BLOCK_THRESHOLDS.medium;
    return totalScore >= threshold;
  }
}

export { INJECTION_PATTERNS, SEVERITY_SCORES, BLOCK_THRESHOLDS };
