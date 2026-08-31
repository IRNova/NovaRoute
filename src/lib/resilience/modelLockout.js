/**
 * Model Lockout — temporarily locks out failing models/providers
 * Prevents wasting requests on known-bad endpoints
 */

export class ModelLockout {
  constructor(options = {}) {
    this.lockouts = new Map(); // provider:model → lockout info
    this.lockoutDurationMs = options.lockoutDurationMs ?? 300_000; // 5 min
    this.maxLockoutDurationMs = options.maxLockoutDurationMs ?? 3_600_000; // 1 hour
    this.failureThreshold = options.failureThreshold ?? 3;
    this.lockoutMultiplier = options.lockoutMultiplier ?? 2;
  }

  /**
   * Record a failure for a provider/model
   */
  recordFailure(provider, model, error = null) {
    const key = this._key(provider, model);
    const existing = this.lockouts.get(key) ?? { count: 0, totalFailures: 0 };

    existing.count += 1;
    existing.totalFailures += 1;
    existing.lastFailureAt = new Date().toISOString();
    existing.lastError = error?.message ?? String(error ?? 'unknown');

    // Apply lockout if threshold reached
    if (existing.count >= this.failureThreshold && !existing.lockedAt) {
      const duration = Math.min(
        this.lockoutDurationMs * Math.pow(this.lockoutMultiplier, existing.count - this.failureThreshold),
        this.maxLockoutDurationMs
      );

      existing.lockedAt = new Date().toISOString();
      existing.unlockAt = new Date(Date.now() + duration).toISOString();
      existing.duration = duration;
    }

    this.lockouts.set(key, existing);
    return this.getStatus(provider, model);
  }

  /**
   * Record a success (resets failure count)
   */
  recordSuccess(provider, model) {
    const key = this._key(provider, model);
    const existing = this.lockouts.get(key);

    if (existing) {
      existing.count = Math.max(0, existing.count - 1);
      if (existing.count === 0) {
        existing.lockedAt = null;
        existing.unlockAt = null;
      }
    } else {
      this.lockouts.set(key, { count: 0, totalFailures: 0 });
    }

    return this.getStatus(provider, model);
  }

  /**
   * Manually lock a provider/model
   */
  lock(provider, model, durationMs = null, reason = 'manual') {
    const key = this._key(provider, model);
    const duration = durationMs ?? this.lockoutDurationMs;

    this.lockouts.set(key, {
      count: this.failureThreshold,
      totalFailures: (this.lockouts.get(key)?.totalFailures ?? 0),
      lockedAt: new Date().toISOString(),
      unlockAt: new Date(Date.now() + duration).toISOString(),
      duration,
      reason,
      lastFailureAt: new Date().toISOString(),
    });

    return this.getStatus(provider, model);
  }

  /**
   * Manually unlock a provider/model
   */
  unlock(provider, model) {
    const key = this._key(provider, model);
    this.lockouts.delete(key);
    return true;
  }

  /**
   * Check if a provider/model is locked
   */
  isLocked(provider, model) {
    const key = this._key(provider, model);
    const lockout = this.lockouts.get(key);

    if (!lockout || !lockout.lockedAt) return false;

    // Check if lockout has expired
    if (lockout.unlockAt && new Date() >= new Date(lockout.unlockAt)) {
      this.lockouts.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get lockout status for a provider/model
   */
  getStatus(provider, model) {
    const key = this._key(provider, model);
    const lockout = this.lockouts.get(key);

    if (!lockout) {
      return { locked: false, failureCount: 0 };
    }

    const isExpired = lockout.unlockAt && new Date() >= new Date(lockout.unlockAt);

    return {
      locked: lockout.lockedAt && !isExpired,
      failureCount: lockout.count,
      totalFailures: lockout.totalFailures,
      lockedAt: lockout.lockedAt,
      unlockAt: lockout.unlockAt,
      duration: lockout.duration,
      reason: lockout.reason,
      lastError: lockout.lastError,
      remainingMs: lockout.unlockAt ? Math.max(0, new Date(lockout.unlockAt).getTime() - Date.now()) : 0,
    };
  }

  /**
   * Get all locked providers/models
   */
  getAllLocked() {
    const locked = [];
    for (const [key, lockout] of this.lockouts.entries()) {
      if (lockout.lockedAt) {
        const isExpired = lockout.unlockAt && new Date() >= new Date(lockout.unlockAt);
        if (!isExpired) {
          const [provider, ...modelParts] = key.split(':');
          locked.push({
            provider,
            model: modelParts.join(':') || null,
            ...this.getStatus(provider, modelParts.join(':') || null),
          });
        }
      }
    }
    return locked;
  }

  /**
   * Get statistics
   */
  getStats() {
    let locked = 0;
    let total = 0;
    for (const lockout of this.lockouts.values()) {
      total += 1;
      if (lockout.lockedAt) {
        const isExpired = lockout.unlockAt && new Date() >= new Date(lockout.unlockAt);
        if (!isExpired) locked += 1;
      }
    }
    return { total, locked, healthy: total - locked };
  }

  /**
   * Cleanup expired lockouts
   */
  cleanup() {
    const now = new Date();
    for (const [key, lockout] of this.lockouts.entries()) {
      if (lockout.unlockAt && now >= new Date(lockout.unlockAt)) {
        this.lockouts.delete(key);
      }
    }
  }

  _key(provider, model) {
    return `${provider}:${model ?? '*'}`;
  }
}

/**
 * Global lockout instance
 */
let globalLockout = null;

export function getGlobalLockout(options = {}) {
  if (!globalLockout) {
    globalLockout = new ModelLockout(options);
  }
  return globalLockout;
}

export function resetGlobalLockout() {
  globalLockout = null;
}
