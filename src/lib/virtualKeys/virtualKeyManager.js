/**
 * Virtual Keys Manager — LiteLLM-style virtual keys with spend tracking
 * 
 * Manages virtual API keys for users, tracks spending per key,
 * enforces limits, and provides usage analytics.
 */

const crypto = require('crypto');

// ============ Key Tiers ============

const KeyTier = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};

// ============ Virtual Key Manager ============

class VirtualKeyManager {
  constructor(options = {}) {
    /** @type {Map<string, VirtualKey>} */
    this.keys = new Map();
    this.spendTracker = new SpendTracker();
    this.rateLimiter = new KeyRateLimiter();
    this.maxKeys = options.maxKeys || 10000;
  }

  /**
   * Create a new virtual key
   */
  createKey(options = {}) {
    const keyId = `sk-novaroute-${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(keyId).digest('hex');

    const key = {
      keyId,
      keyHash,
      name: options.name || 'Unnamed Key',
      userId: options.userId || null,
      tier: options.tier || KeyTier.FREE,
      enabled: true,
      
      // Limits
      maxRequests: options.maxRequests || 1000,
      maxTokens: options.maxTokens || 1_000_000,
      maxCost: options.maxCost || 10.0, // USD
      rateLimitRpm: options.rateLimitRpm || 60, // requests per minute
      
      // Current usage
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      
      // Allowed models (null = all)
      allowedModels: options.allowedModels || null,
      
      // Metadata
      metadata: options.metadata || {},
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: options.expiresAt || null,
    };

    this.keys.set(keyId, key);
    this.schedulePersist();
    return { keyId, key }; // Return full key only on creation
  }

  /**
   * Validate a virtual key
   */
  validate(keyId) {
    const key = this.keys.get(keyId);
    if (!key) return { valid: false, reason: 'Key not found' };
    if (!key.enabled) return { valid: false, reason: 'Key disabled' };
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return { valid: false, reason: 'Key expired' };
    }

    // Check limits
    if (key.totalRequests >= key.maxRequests) {
      return { valid: false, reason: 'Request limit exceeded' };
    }
    if (key.totalTokens >= key.maxTokens) {
      return { valid: false, reason: 'Token limit exceeded' };
    }
    if (key.totalCost >= key.maxCost) {
      return { valid: false, reason: 'Cost limit exceeded' };
    }

    // Check rate limit
    const rateLimit = this.rateLimiter.check(keyId, key.rateLimitRpm);
    if (!rateLimit.allowed) {
      return { valid: false, reason: 'Rate limit exceeded', retryAfterMs: rateLimit.retryAfterMs };
    }

    return { valid: true, key };
  }

  /**
   * Record usage for a key
   */
  recordUsage(keyId, usage) {
    const key = this.keys.get(keyId);
    if (!key) return;

    key.totalRequests += 1;
    key.totalTokens += usage.tokens || 0;
    key.totalCost += usage.cost || 0;
    key.lastUsedAt = new Date().toISOString();

    this.spendTracker.record(keyId, usage);
    this.schedulePersist();
  }

  /**
   * Check if a model is allowed for this key
   */
  isModelAllowed(keyId, model) {
    const key = this.keys.get(keyId);
    if (!key) return false;
    if (!key.allowedModels) return true; // null = all models
    return key.allowedModels.some(m => model.startsWith(m));
  }

  /**
   * Get key by ID
   */
  getKey(keyId) {
    return this.keys.get(keyId);
  }

  /**
   * List keys with filtering
   */
  listKeys(filter = {}) {
    let keys = [...this.keys.values()];
    if (filter.userId) keys = keys.filter(k => k.userId === filter.userId);
    if (filter.tier) keys = keys.filter(k => k.tier === filter.tier);
    if (filter.enabled !== undefined) keys = keys.filter(k => k.enabled === filter.enabled);
    
    // Return sanitized (no keyId hash)
    return keys.map(k => ({
      keyId: k.keyId,
      name: k.name,
      userId: k.userId,
      tier: k.tier,
      enabled: k.enabled,
      totalRequests: k.totalRequests,
      totalTokens: k.totalTokens,
      totalCost: k.totalCost,
      maxRequests: k.maxRequests,
      maxTokens: k.maxTokens,
      maxCost: k.maxCost,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));
  }

  /**
   * Update key settings
   */
  updateKey(keyId, updates) {
    const key = this.keys.get(keyId);
    if (!key) throw new Error(`Key not found: ${keyId}`);
    Object.assign(key, updates);
    this.schedulePersist();
    return key;
  }

  /**
   * Delete a key
   */
  deleteKey(keyId) {
    const removed = this.keys.delete(keyId);
    if (removed) this.schedulePersist();
    return removed;
  }

  /**
   * Enable/disable a key
   */
  toggleKey(keyId, enabled) {
    const key = this.keys.get(keyId);
    if (!key) throw new Error(`Key not found: ${keyId}`);
    key.enabled = enabled;
    this.schedulePersist();
    return key;
  }

  /**
   * Get spend summary
   */
  getSpendSummary(keyId) {
    return this.spendTracker.getSummary(keyId);
  }

  /**
   * Get total spend across all keys
   */
  getTotalSpend() {
    let totalCost = 0;
    let totalTokens = 0;
    let totalRequests = 0;

    for (const key of this.keys.values()) {
      totalCost += key.totalCost;
      totalTokens += key.totalTokens;
      totalRequests += key.totalRequests;
    }

    return { totalCost, totalTokens, totalRequests, keyCount: this.keys.size };
  }
}

// ============ Spend Tracker ============

class SpendTracker {
  constructor() {
    /** @type {Map<string, SpendEntry[]>} */
    this.entries = new Map();
    this.maxEntries = 10000;
  }

  record(keyId, usage) {
    const entries = this.entries.get(keyId) || [];
    entries.push({
      timestamp: new Date().toISOString(),
      tokens: usage.tokens || 0,
      cost: usage.cost || 0,
      model: usage.model || 'unknown',
      provider: usage.provider || 'unknown',
    });

    if (entries.length > this.maxEntries) {
      entries.splice(0, entries.length - this.maxEntries);
    }

    this.entries.set(keyId, entries);
  }

  getSummary(keyId, period = '24h') {
    const entries = this.entries.get(keyId) || [];
    const since = new Date(Date.now() - this._parsePeriod(period)).toISOString();
    const recent = entries.filter(e => e.timestamp >= since);

    return {
      totalCost: recent.reduce((s, e) => s + e.cost, 0),
      totalTokens: recent.reduce((s, e) => s + e.tokens, 0),
      totalRequests: recent.length,
      byModel: this._groupBy(recent, 'model'),
      byProvider: this._groupBy(recent, 'provider'),
      period,
    };
  }

  _parsePeriod(period) {
    const match = period.match(/^(\d+)([smhd])$/);
    if (!match) return 86400000;
    const [, num, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(num) * (multipliers[unit] || 86400000);
  }

  _groupBy(entries, field) {
    return entries.reduce((acc, e) => {
      const key = e[field] || 'unknown';
      acc[key] = (acc[key] || 0) + e[field === 'model' ? 'tokens' : 'cost'];
      return acc;
    }, {});
  }
}

// ============ Rate Limiter ============

class KeyRateLimiter {
  constructor() {
    this.windows = new Map();
  }

  check(keyId, rpm) {
    const now = Date.now();
    const window = this.windows.get(keyId);

    if (!window || now >= window.resetAt) {
      this.windows.set(keyId, { count: 1, resetAt: now + 60000 });
      return { allowed: true };
    }

    window.count += 1;
    const allowed = window.count <= rpm;

    return {
      allowed,
      retryAfterMs: allowed ? 0 : window.resetAt - now,
    };
  }
}

// Singleton
let _instance = null;

function getVirtualKeyManager() {
  if (!_instance) _instance = new VirtualKeyManager();
  return _instance;
}

// ─── SQLite persistence (kv-backed; survives restarts) ───
// The manager itself stays synchronous; persistence is fire-and-forget after
// mutations and lazily restored before first read via ensureLoaded().
const VK_PERSIST_KEY = "virtualKeys";
let _vkLoaded = false;
let _vkPersistTimer = null;

VirtualKeyManager.prototype.ensureLoaded = async function ensureLoaded() {
  if (_vkLoaded) return;
  _vkLoaded = true;
  try {
    const { makeKv } = await import("../db/helpers/kvStore.js");
    const list = await makeKv("security").get(VK_PERSIST_KEY, []);
    if (Array.isArray(list)) {
      for (const k of list) {
        if (k && k.keyId && !this.keys.has(k.keyId)) this.keys.set(k.keyId, k);
      }
    }
  } catch {}
};

VirtualKeyManager.prototype.schedulePersist = function schedulePersist() {
  if (_vkPersistTimer) return;
  _vkPersistTimer = setTimeout(async () => {
    _vkPersistTimer = null;
    try {
      const { makeKv } = await import("../db/helpers/kvStore.js");
      await makeKv("security").set(VK_PERSIST_KEY, [...this.keys.values()]);
    } catch {}
  }, 400);
  if (_vkPersistTimer.unref) _vkPersistTimer.unref();
};

module.exports = {
  KeyTier,
  VirtualKeyManager,
  SpendTracker,
  KeyRateLimiter,
  getVirtualKeyManager,
};
