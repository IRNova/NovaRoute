/**
 * Security System — rate limiting, IP blocking, API key validation, input sanitization
 */

// ─── Rate Limiter ──────────────────────────────────────────────────────────

export class RateLimiter {
  constructor(options = {}) {
    this.windows = new Map(); // key → { count, resetAt }
    this.windowMs = options.windowMs ?? 60_000; // 1 minute
    this.maxRequests = options.maxRequests ?? 60;
    this.keyPrefix = options.keyPrefix ?? 'rl';
  }

  /**
   * Check if a request is allowed
   */
  check(key, limit = null) {
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    const window = this.windows.get(fullKey);

    if (!window || now >= window.resetAt) {
      // New window
      this.windows.set(fullKey, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: (limit ?? this.maxRequests) - 1 };
    }

    window.count += 1;
    const max = limit ?? this.maxRequests;
    const allowed = window.count <= max;

    return {
      allowed,
      remaining: Math.max(0, max - window.count),
      resetAt: window.resetAt,
      retryAfterMs: allowed ? 0 : window.resetAt - now,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key) {
    const fullKey = `${this.keyPrefix}:${key}`;
    this.windows.delete(fullKey);
    return true;
  }

  /**
   * Get current usage
   */
  getUsage(key) {
    const fullKey = `${this.keyPrefix}:${key}`;
    const window = this.windows.get(fullKey);
    if (!window) return { count: 0, remaining: this.maxRequests };
    return { count: window.count, remaining: Math.max(0, this.maxRequests - window.count), resetAt: window.resetAt };
  }

  /**
   * Cleanup expired windows
   */
  cleanup() {
    const now = Date.now();
    for (const [key, window] of this.windows.entries()) {
      if (now >= window.resetAt) this.windows.delete(key);
    }
  }
}

// ─── IP Blocker ────────────────────────────────────────────────────────────

export class IPBlocker {
  constructor(options = {}) {
    this.blocked = new Set(options.blockedIPs ?? []);
    this.allowed = new Set(options.allowedIPs ?? []);
    this.blockedByPattern = options.blockPatterns ?? [];
    this.temporary = new Map(); // IP → expiry
  }

  /**
   * Check if an IP is blocked
   */
  isBlocked(ip) {
    // Check permanent block
    if (this.blocked.has(ip)) return { blocked: true, reason: 'permanent' };

    // Check temporary block
    const temp = this.temporary.get(ip);
    if (temp) {
      if (Date.now() < temp.expiry) {
        return { blocked: true, reason: 'temporary', expiresAt: temp.expiresAt };
      }
      this.temporary.delete(ip);
    }

    // Check patterns
    for (const pattern of this.blockedByPattern) {
      if (pattern.test?.(ip) || (typeof pattern === 'string' && ip.startsWith(pattern))) {
        return { blocked: true, reason: 'pattern' };
      }
    }

    // Check allowlist (if set, only these are allowed)
    if (this.allowed.size > 0 && !this.allowed.has(ip)) {
      return { blocked: true, reason: 'not_in_allowlist' };
    }

    return { blocked: false };
  }

  /**
   * Block an IP
   */
  blockIP(ip, durationMs = null) {
    if (durationMs) {
      this.temporary.set(ip, {
        expiry: Date.now() + durationMs,
        expiresAt: new Date(Date.now() + durationMs).toISOString(),
      });
    } else {
      this.blocked.add(ip);
    }
    return true;
  }

  /**
   * Unblock an IP
   */
  unblockIP(ip) {
    this.blocked.delete(ip);
    this.temporary.delete(ip);
    return true;
  }

  /**
   * Get all blocked IPs
   */
  getBlocked() {
    const permanent = [...this.blocked];
    const temporary = [];
    for (const [ip, data] of this.temporary.entries()) {
      if (Date.now() < data.expiry) {
        temporary.push({ ip, expiresAt: data.expiresAt });
      }
    }
    return { permanent, temporary };
  }
}

// ─── Input Sanitizer ───────────────────────────────────────────────────────

export class InputSanitizer {
  constructor(options = {}) {
    this.maxInputLength = options.maxInputLength ?? 100_000;
    this.maxMessageCount = options.maxMessageCount ?? 100;
    this.stripControlChars = options.stripControlChars !== false;
    this.maxNestingDepth = options.maxNestingDepth ?? 10;
  }

  /**
   * Sanitize a chat request
   */
  sanitizeChatRequest(body) {
    const errors = [];

    if (!body) return { valid: false, errors: ['Empty request body'] };

    // Check messages array
    if (!Array.isArray(body.messages)) {
      errors.push('messages must be an array');
      return { valid: false, errors };
    }

    if (body.messages.length > this.maxMessageCount) {
      errors.push(`Too many messages: ${body.messages.length} (max: ${this.maxMessageCount})`);
    }

    // Sanitize each message
    const sanitizedMessages = body.messages.map((msg, i) => {
      const sanitized = { ...msg };

      // Validate role
      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        errors.push(`Invalid role at message ${i}: ${msg.role}`);
      }

      // Sanitize content
      if (typeof msg.content === 'string') {
        sanitized.content = this._sanitizeText(msg.content, `message[${i}].content`);
      } else if (Array.isArray(msg.content)) {
        sanitized.content = msg.content.map(part => {
          if (part.type === 'text') {
            return { ...part, text: this._sanitizeText(part.text, `message[${i}].content[text]`) };
          }
          return part;
        });
      }

      return sanitized;
    });

    return {
      valid: errors.length === 0,
      errors,
      sanitized: { ...body, messages: sanitizedMessages },
    };
  }

  _sanitizeText(text, path) {
    if (typeof text !== 'string') return text;

    // Length check
    if (text.length > this.maxInputLength) {
      return text.slice(0, this.maxInputLength);
    }

    // Strip control characters
    if (this.stripControlChars) {
      text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    return text;
  }
}

// ─── API Key Validator ─────────────────────────────────────────────────────

export class APIKeyValidator {
  constructor(options = {}) {
    this.keys = new Map(); // key → { userId, permissions, createdAt, lastUsedAt }
    this.hashFunction = options.hashFunction ?? null;
  }

  /**
   * Register an API key
   */
  register(key, data = {}) {
    const keyId = this.hashFunction ? this.hashFunction(key) : key;
    this.keys.set(keyId, {
      keyId,
      userId: data.userId,
      permissions: data.permissions ?? ['read', 'write'],
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      enabled: true,
    });
    return keyId;
  }

  /**
   * Validate an API key
   */
  validate(key) {
    const keyId = this.hashFunction ? this.hashFunction(key) : key;
    const keyData = this.keys.get(keyId);

    if (!keyData) return { valid: false, reason: 'key_not_found' };
    if (!keyData.enabled) return { valid: false, reason: 'key_disabled' };

    // Update last used
    keyData.lastUsedAt = new Date().toISOString();

    return { valid: true, keyData };
  }

  /**
   * Check permission
   */
  hasPermission(key, permission) {
    const keyId = this.hashFunction ? this.hashFunction(key) : key;
    const keyData = this.keys.get(keyId);
    if (!keyData) return false;
    return keyData.permissions.includes(permission);
  }

  /**
   * Revoke a key
   */
  revoke(key) {
    const keyId = this.hashFunction ? this.hashFunction(key) : key;
    return this.keys.delete(keyId);
  }

  /**
   * List all keys (sanitized)
   */
  listKeys() {
    return [...this.keys.values()].map(k => ({
      keyId: k.keyId.slice(0, 8) + '...',
      userId: k.userId,
      permissions: k.permissions,
      enabled: k.enabled,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));
  }
}
