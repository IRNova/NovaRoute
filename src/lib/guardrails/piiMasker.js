/**
 * PII Masker — detects and masks Personally Identifiable Information
 * Supports: emails, phones, SSNs, credit cards, IPs, addresses, names, DOBs
 */

import { BaseGuardrail } from './base.js';

// ─── PII Detection Patterns ────────────────────────────────────────────────
const PII_PATTERNS = [
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: 'high',
    mask: (match) => match[0] + '***@' + match[0].split('@')[1],
  },
  {
    name: 'phone_us',
    pattern: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    severity: 'high',
    mask: (match) => match.slice(0, 3) + '-***-' + match.slice(-4),
  },
  {
    name: 'phone_intl',
    pattern: /\+(?:[0-9][\-\.]?){6,14}[0-9]/g,
    severity: 'high',
    mask: (match) => match.slice(0, 4) + '****' + match.slice(-3),
  },
  {
    name: 'ssn',
    pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    severity: 'critical',
    mask: () => '***-**-****',
  },
  {
    name: 'credit_card_visa',
    pattern: /\b4[0-9]{3}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/g,
    severity: 'critical',
    mask: (match) => '****-****-****-' + match.slice(-4),
  },
  {
    name: 'credit_card_mc',
    pattern: /\b5[1-5][0-9]{2}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/g,
    severity: 'critical',
    mask: (match) => '****-****-****-' + match.slice(-4),
  },
  {
    name: 'credit_card_amex',
    pattern: /\b3[47][0-9]{2}[-\s]?[0-9]{6}[-\s]?[0-9]{5}\b/g,
    severity: 'critical',
    mask: (match) => '****-******-' + match.slice(-5),
  },
  {
    name: 'ipv4',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    severity: 'medium',
    mask: (match) => match.split('.').map((o, i) => i < 3 ? o : '*').join('.'),
  },
  {
    name: 'ipv6',
    pattern: /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g,
    severity: 'medium',
    mask: () => '****:****:****:****:****:****:****:****',
  },
  {
    name: 'date_of_birth',
    pattern: /\b(?:0[1-9]|1[0-2])[\/\-](?:0[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g,
    severity: 'high',
    mask: () => '**/**/****',
  },
  {
    name: 'iban',
    pattern: /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{0,4}\b/g,
    severity: 'critical',
    mask: (match) => match.slice(0, 4) + '****' + match.slice(-4),
  },
  {
    name: 'passport',
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    severity: 'high',
    mask: (match) => match[0] + '*'.repeat(match.length - 2) + match.slice(-1),
  },
  {
    name: 'aws_key',
    pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g,
    severity: 'critical',
    mask: (match) => match.slice(0, 4) + '*'.repeat(12) + match.slice(-4),
  },
  {
    name: 'api_key_generic',
    pattern: /\b(?:sk|pk|api|key|token|secret)[_-][A-Za-z0-9]{20,}\b/gi,
    severity: 'critical',
    mask: (match) => match.slice(0, 8) + '*'.repeat(Math.max(0, match.length - 12)) + match.slice(-4),
  },
];

// ─── Masking functions ──────────────────────────────────────────────────────

/**
 * Mask PII in text
 */
export function maskPII(text, options = {}) {
  const { replacementChar = '*', maskTypes, customPatterns = [] } = options;
  const detections = [];
  let maskedText = text;
  const allPatterns = [...PII_PATTERNS, ...customPatterns];

  for (const pii of allPatterns) {
    if (maskTypes && !maskTypes.includes(pii.name)) continue;

    const regex = new RegExp(pii.pattern.source, pii.pattern.flags);
    let match;
    while ((match = regex.exec(maskedText)) !== null) {
      detections.push({
        type: pii.name,
        position: match.index,
        length: match[0].length,
        severity: pii.severity,
        masked: pii.mask ? pii.mask(match) : replacementChar.repeat(match[0].length),
      });
    }

    maskedText = maskedText.replace(pii.pattern, (m) => {
      return pii.mask ? pii.mask([m]) : replacementChar.repeat(m.length);
    });
  }

  return { masked: maskedText, detections };
}

/**
 * Scan text for PII without masking
 */
export function scanPII(text, options = {}) {
  const { scanTypes, customPatterns = [] } = options;
  const detections = [];
  const allPatterns = [...PII_PATTERNS, ...customPatterns];

  for (const pii of allPatterns) {
    if (scanTypes && !scanTypes.includes(pii.name)) continue;

    const regex = new RegExp(pii.pattern.source, pii.pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: pii.name,
        value: match[0],
        position: match.index,
        length: match[0].length,
        severity: pii.severity,
      });
    }
  }

  return detections;
}

// ─── Guardrail Class ────────────────────────────────────────────────────────

export class PIIMaskingGuardrail extends BaseGuardrail {
  constructor(options = {}) {
    super('pii-masking', options);
    this.action = options.action ?? 'mask'; // mask | redact | block
    this.maskTypes = options.maskTypes;
    this.customPatterns = options.customPatterns ?? [];
  }

  async execute(context) {
    const messages = context.messages ?? [];
    const allDetections = [];
    let modifiedMessages = [...messages];

    for (let i = 0; i < modifiedMessages.length; i++) {
      const msg = modifiedMessages[i];
      const text = this._extractText(msg);
      if (!text) continue;

      const result = maskPII(text, {
        maskTypes: this.maskTypes,
        customPatterns: this.customPatterns,
      });

      if (result.detections.length > 0) {
        allDetections.push(...result.detections.map(d => ({
          ...d,
          messageIndex: i,
          role: msg.role,
        })));

        if (this.action === 'mask' || this.action === 'redact') {
          modifiedMessages[i] = this._replaceContent(msg, result.masked);
        }
      }
    }

    const blocked = this.action === 'block' && allDetections.length > 0;

    if (allDetections.length > 0) {
      this.logger.info(
        `[Guardrail:pii-masking] Found ${allDetections.length} PII items, action=${this.action}`
      );
    }

    return {
      blocked,
      guardrail: 'pii-masking',
      severity: allDetections.length > 0 ? 'high' : 'low',
      detections: allDetections,
      modifiedMessages: (this.action === 'mask' || this.action === 'redact') ? modifiedMessages : undefined,
      metadata: {
        totalPII: allDetections.length,
        action: this.action,
      },
    };
  }

  _extractText(message) {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
    }
    return '';
  }

  _replaceContent(message, newContent) {
    if (typeof message.content === 'string') {
      return { ...message, content: newContent };
    }
    if (Array.isArray(message.content)) {
      return {
        ...message,
        content: message.content.map(p =>
          p.type === 'text' ? { ...p, text: newContent } : p
        ),
      };
    }
    return message;
  }
}

export { PII_PATTERNS };
