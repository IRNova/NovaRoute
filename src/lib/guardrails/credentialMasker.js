/**
 * Credential Masker — detects and masks API keys, tokens, passwords, secrets
 * in request/response payloads
 */

import { BaseGuardrail } from './base.js';

// ─── Credential Detection Patterns ─────────────────────────────────────────
const CREDENTIAL_PATTERNS = [
  // OpenAI
  { name: 'openai_key', pattern: /\bsk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}\b/g, severity: 'critical' },
  { name: 'openai_key_v2', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/g, severity: 'critical' },
  // Anthropic
  { name: 'anthropic_key', pattern: /\bsk-ant-[A-Za-z0-9_-]{40,}\b/g, severity: 'critical' },
  // Google
  { name: 'google_api_key', pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g, severity: 'critical' },
  { name: 'google_oauth', pattern: /\bya29\.[A-Za-z0-9_-]+/g, severity: 'critical' },
  // AWS
  { name: 'aws_access_key', pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g, severity: 'critical' },
  { name: 'aws_secret_key', pattern: /\b[A-Za-z0-9/+=]{40}\b/g, severity: 'medium' },
  // GitHub
  { name: 'github_token', pattern: /\bgh[ps]_[A-Za-z0-9_]{36,}\b/g, severity: 'critical' },
  { name: 'github_pat', pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, severity: 'critical' },
  // GitLab
  { name: 'gitlab_token', pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, severity: 'critical' },
  // Slack
  { name: 'slack_token', pattern: /\bxox[bpras]-[A-Za-z0-9-]+/g, severity: 'critical' },
  // Telegram
  { name: 'telegram_token', pattern: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g, severity: 'high' },
  // Discord
  { name: 'discord_token', pattern: /\b[MB][A-Za-z0-9_-]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}\b/g, severity: 'critical' },
  // Stripe
  { name: 'stripe_key', pattern: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g, severity: 'critical' },
  // Twilio
  { name: 'twilio_key', pattern: /\bSK[A-Za-z0-9]{32}\b/g, severity: 'critical' },
  // SendGrid
  { name: 'sendgrid_key', pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, severity: 'critical' },
  // Heroku
  { name: 'heroku_key', pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, severity: 'high' },
  // JWT tokens
  { name: 'jwt_token', pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, severity: 'high' },
  // Bearer tokens in headers
  { name: 'bearer_token', pattern: /\bBearer\s+[A-Za-z0-9_\-\.]{20,}\b/gi, severity: 'critical' },
  // Private keys
  { name: 'private_key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, severity: 'critical' },
  // Generic password patterns
  { name: 'password_field', pattern: /(?:password|passwd|pwd)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi, severity: 'high' },
  { name: 'secret_field', pattern: /(?:secret|secret_key|secret_key_id)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi, severity: 'high' },
  // Connection strings
  { name: 'connection_string', pattern: /(?:mongodb|mysql|postgres|redis|amqp):\/\/[^\s"']+/gi, severity: 'critical' },
  // Base64 encoded secrets (common patterns)
  { name: 'base64_secret', pattern: /\b[A-Za-z0-9+\/]{40,}={0,2}\b/g, severity: 'low' },
];

/**
 * Mask a credential match
 */
function maskCredential(match, patternName) {
  const str = match[0];
  if (str.length <= 8) return '*'.repeat(str.length);
  return str.slice(0, 4) + '*'.repeat(str.length - 8) + str.slice(-4);
}

/**
 * Scan text for credentials
 */
export function scanCredentials(text, options = {}) {
  const { scanTypes, customPatterns = [] } = options;
  const detections = [];
  const allPatterns = [...CREDENTIAL_PATTERNS, ...customPatterns];

  for (const cred of allPatterns) {
    if (scanTypes && !scanTypes.includes(cred.name)) continue;

    const regex = new RegExp(cred.pattern.source, cred.pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type: cred.name,
        value: match[0],
        masked: maskCredential(match, cred.name),
        position: match.index,
        length: match[0].length,
        severity: cred.severity,
      });
    }
  }

  return detections;
}

/**
 * Mask credentials in text
 */
export function maskCredentials(text, options = {}) {
  const { scanTypes, customPatterns = [] } = options;
  const detections = [];
  let maskedText = text;
  const allPatterns = [...CREDENTIAL_PATTERNS, ...customPatterns];

  for (const cred of allPatterns) {
    if (scanTypes && !scanTypes.includes(cred.name)) continue;

    maskedText = maskedText.replace(cred.pattern, (m) => {
      const masked = maskCredential([m], cred.name);
      detections.push({
        type: cred.name,
        value: m,
        masked,
        severity: cred.severity,
      });
      return masked;
    });
  }

  return { masked: maskedText, detections };
}

// ─── Guardrail Class ────────────────────────────────────────────────────────

export class CredentialMaskingGuardrail extends BaseGuardrail {
  constructor(options = {}) {
    super('credential-masking', options);
    this.action = options.action ?? 'mask'; // mask | block
    this.scanTypes = options.scanTypes;
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

      const result = maskCredentials(text, {
        scanTypes: this.scanTypes,
        customPatterns: this.customPatterns,
      });

      if (result.detections.length > 0) {
        allDetections.push(...result.detections.map(d => ({
          ...d,
          messageIndex: i,
          role: msg.role,
        })));

        if (this.action === 'mask') {
          modifiedMessages[i] = this._replaceContent(msg, result.masked);
        }
      }
    }

    // Also scan headers and metadata
    if (context.headers) {
      const headerDetections = this._scanHeaders(context.headers);
      allDetections.push(...headerDetections);
    }

    const blocked = this.action === 'block' && allDetections.length > 0;

    return {
      blocked,
      guardrail: 'credential-masking',
      severity: allDetections.some(d => d.severity === 'critical') ? 'critical' : allDetections.length > 0 ? 'high' : 'low',
      detections: allDetections,
      modifiedMessages: this.action === 'mask' ? modifiedMessages : undefined,
      metadata: {
        totalCredentials: allDetections.length,
        action: this.action,
      },
    };
  }

  _scanHeaders(headers) {
    const detections = [];
    const sensitiveHeaders = ['authorization', 'x-api-key', 'x-auth-token', 'cookie'];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        detections.push({
          type: 'sensitive_header',
          header: key,
          value: value,
          severity: 'high',
        });
      }
    }

    return detections;
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

export { CREDENTIAL_PATTERNS };
