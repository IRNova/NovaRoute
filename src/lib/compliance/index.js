/**
 * Compliance & Audit System — request logging, access control, policy enforcement
 * Modeled after OmniRoute's compliance module
 */

// ─── Audit Logger ──────────────────────────────────────────────────────────

export class AuditLogger {
  constructor(options = {}) {
    this.entries = [];
    this.maxEntries = options.maxEntries ?? 10_000;
    this.retentionDays = options.retentionDays ?? 90;
    this.sink = options.sink ?? null; // external sink (e.g., database)
    this.sensitiveFields = new Set(options.sensitiveFields ?? [
      'authorization', 'x-api-key', 'cookie', 'password', 'secret', 'token',
    ]);
  }

  /**
   * Log an audit event
   */
  async log(event) {
    const entry = {
      id: this._generateId(),
      timestamp: new Date().toISOString(),
      ...event,
      // Mask sensitive data
      headers: event.headers ? this._maskSensitive(event.headers) : undefined,
    };

    this.entries.push(entry);

    // Trim old entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Send to external sink
    if (this.sink) {
      try {
        await this.sink.write(entry);
      } catch (err) {
        console.error('[AuditLogger] Sink error:', err.message);
      }
    }

    return entry;
  }

  /**
   * Query audit events
   */
  query(filter = {}) {
    let results = [...this.entries];

    if (filter.userId) results = results.filter(e => e.userId === filter.userId);
    if (filter.action) results = results.filter(e => e.action === filter.action);
    if (filter.provider) results = results.filter(e => e.provider === filter.provider);
    if (filter.since) results = results.filter(e => new Date(e.timestamp) >= new Date(filter.since));
    if (filter.until) results = results.filter(e => new Date(e.timestamp) <= new Date(filter.until));
    if (filter.severity) results = results.filter(e => e.severity === filter.severity);

    if (filter.limit) results = results.slice(-filter.limit);

    return results;
  }

  /**
   * Get statistics
   */
  getStats(period = '24h') {
    const since = new Date(Date.now() - this._parsePeriod(period)).toISOString();
    const recent = this.entries.filter(e => e.timestamp >= since);

    const byAction = {};
    const bySeverity = {};
    const byProvider = {};

    for (const entry of recent) {
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      bySeverity[entry.severity || 'info'] = (bySeverity[entry.severity || 'info'] || 0) + 1;
      if (entry.provider) byProvider[entry.provider] = (byProvider[entry.provider] || 0) + 1;
    }

    return {
      total: recent.length,
      byAction,
      bySeverity,
      byProvider,
      period,
    };
  }

  _maskSensitive(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;

    const masked = { ...obj };
    for (const [key, value] of Object.entries(masked)) {
      if (this.sensitiveFields.has(key.toLowerCase())) {
        masked[key] = typeof value === 'string' ? value.slice(0, 4) + '****' : '****';
      }
    }
    return masked;
  }

  _generateId() {
    return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _parsePeriod(period) {
    const match = period.match(/^(\d+)([smhd])$/);
    if (!match) return 86400000; // default 24h
    const [, num, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(num) * (multipliers[unit] || 86400000);
  }
}

// ─── Policy Engine ─────────────────────────────────────────────────────────

export class PolicyEngine {
  constructor(options = {}) {
    this.policies = [];
    this.defaultAction = options.defaultAction ?? 'allow';
  }

  /**
   * Add a policy
   */
  addPolicy(policy) {
    this.policies.push({
      id: policy.id ?? `policy_${Date.now()}`,
      name: policy.name ?? 'Unnamed Policy',
      description: policy.description ?? '',
      effect: policy.effect ?? 'allow', // allow | deny
      conditions: policy.conditions ?? [],
      priority: policy.priority ?? 0,
      enabled: policy.enabled !== false,
      createdAt: new Date().toISOString(),
    });
    this.policies.sort((a, b) => b.priority - a.priority);
    return this;
  }

  /**
   * Evaluate a request against all policies
   */
  evaluate(request) {
    for (const policy of this.policies) {
      if (!policy.enabled) continue;

      const matches = this._matchConditions(request, policy.conditions);
      if (matches) {
        return {
          allowed: policy.effect === 'allow',
          policy: policy.id,
          policyName: policy.name,
          reason: policy.description,
        };
      }
    }

    return {
      allowed: this.defaultAction === 'allow',
      policy: null,
      policyName: 'default',
      reason: 'No matching policy',
    };
  }

  /**
   * List all policies
   */
  listPolicies() {
    return [...this.policies];
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId) {
    this.policies = this.policies.filter(p => p.id !== policyId);
    return true;
  }

  _matchConditions(request, conditions) {
    if (conditions.length === 0) return true;

    return conditions.every(condition => {
      const value = this._resolvePath(request, condition.path);
      return this._evaluateOperator(value, condition.operator, condition.value);
    });
  }

  _resolvePath(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  _evaluateOperator(value, operator, expected) {
    switch (operator) {
      case 'equals': return value === expected;
      case 'not_equals': return value !== expected;
      case 'contains': return String(value).includes(String(expected));
      case 'starts_with': return String(value).startsWith(String(expected));
      case 'ends_with': return String(value).endsWith(String(expected));
      case 'gt': return Number(value) > Number(expected);
      case 'lt': return Number(value) < Number(expected);
      case 'gte': return Number(value) >= Number(expected);
      case 'lte': return Number(value) <= Number(expected);
      case 'in': return Array.isArray(expected) && expected.includes(value);
      case 'not_in': return Array.isArray(expected) && !expected.includes(value);
      case 'regex': return new RegExp(expected).test(String(value));
      default: return false;
    }
  }
}

// ─── Usage Tracking ────────────────────────────────────────────────────────

export class UsageTracker {
  constructor(options = {}) {
    this.usage = new Map(); // userId → usage data
    this.limits = options.limits ?? {};
  }

  /**
   * Track usage
   */
  async track(userId, event) {
    const current = this.usage.get(userId) ?? this._emptyUsage();

    current.totalRequests += 1;
    current.totalTokens += event.tokens ?? 0;
    current.totalCost += event.cost ?? 0;

    if (event.provider) {
      current.byProvider[event.provider] = (current.byProvider[event.provider] || 0) + 1;
    }
    if (event.model) {
      current.byModel[event.model] = (current.byModel[event.model] || 0) + 1;
    }

    // Daily tracking
    const today = new Date().toISOString().split('T')[0];
    current.daily[today] = (current.daily[today] || 0) + 1;

    this.usage.set(userId, current);
    return current;
  }

  /**
   * Check if user is within limits
   */
  checkLimits(userId) {
    const current = this.usage.get(userId) ?? this._emptyUsage();
    const limits = this.limits[userId] ?? this.limits.default ?? {};

    const violations = [];

    if (limits.maxRequests && current.totalRequests > limits.maxRequests) {
      violations.push({ type: 'requests', current: current.totalRequests, limit: limits.maxRequests });
    }
    if (limits.maxTokens && current.totalTokens > limits.maxTokens) {
      violations.push({ type: 'tokens', current: current.totalTokens, limit: limits.maxTokens });
    }
    if (limits.maxCost && current.totalCost > limits.maxCost) {
      violations.push({ type: 'cost', current: current.totalCost, limit: limits.maxCost });
    }

    return { allowed: violations.length === 0, violations };
  }

  /**
   * Get usage for user
   */
  getUsage(userId) {
    return this.usage.get(userId) ?? this._emptyUsage();
  }

  _emptyUsage() {
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {},
      byModel: {},
      daily: {},
    };
  }
}

// ─── No-Log Mode ───────────────────────────────────────────────────────────

export class NoLogEnforcer {
  constructor(options = {}) {
    this.noLogUsers = new Set(options.noLogUsers ?? []);
    this.noLogProviders = new Set(options.noLogProviders ?? []);
  }

  /**
   * Check if logging should be suppressed
   */
  shouldSuppress(userId, provider) {
    if (userId && this.noLogUsers.has(userId)) return true;
    if (provider && this.noLogProviders.has(provider)) return true;
    return false;
  }

  /**
   * Add a user to no-log list
   */
  addNoLogUser(userId) {
    this.noLogUsers.add(userId);
    return true;
  }

  /**
   * Remove a user from no-log list
   */
  removeNoLogUser(userId) {
    this.noLogUsers.delete(userId);
    return true;
  }

  /**
   * Add a provider to no-log list
   */
  addNoLogProvider(provider) {
    this.noLogProviders.add(provider);
    return true;
  }
}
