/**
 * Monitoring & Observability — metrics, health checks, alerts
 */

// ─── Metrics Collector ─────────────────────────────────────────────────────

export class MetricsCollector {
  constructor(options = {}) {
    this.metrics = new Map(); // name → { values, timestamps }
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.flushInterval = options.flushIntervalMs ?? 60_000;
    this.maxSamples = options.maxSamples ?? 1000;
    this._startFlush();
  }

  /**
   * Increment a counter
   */
  increment(name, value = 1, tags = {}) {
    const key = this._makeKey(name, tags);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  /**
   * Set a gauge value
   */
  gauge(name, value, tags = {}) {
    const key = this._makeKey(name, tags);
    this.gauges.set(key, { value, updatedAt: Date.now() });
  }

  /**
   * Record a histogram value
   */
  histogram(name, value, tags = {}) {
    const key = this._makeKey(name, tags);
    const hist = this.histograms.get(key) ?? { values: [], count: 0, sum: 0, min: Infinity, max: -Infinity };

    hist.values.push(value);
    if (hist.values.length > this.maxSamples) hist.values.shift();
    hist.count += 1;
    hist.sum += value;
    hist.min = Math.min(hist.min, value);
    hist.max = Math.max(hist.max, value);

    this.histograms.set(key, hist);
  }

  /**
   * Get a counter value
   */
  getCounter(name, tags = {}) {
    return this.counters.get(this._makeKey(name, tags)) ?? 0;
  }

  /**
   * Get a gauge value
   */
  getGauge(name, tags = {}) {
    return this.gauges.get(this._makeKey(name, tags))?.value ?? null;
  }

  /**
   * Get histogram stats
   */
  getHistogram(name, tags = {}) {
    const hist = this.histograms.get(this._makeKey(name, tags));
    if (!hist) return null;

    const sorted = [...hist.values].sort((a, b) => a - b);
    return {
      count: hist.count,
      sum: hist.sum,
      min: hist.min,
      max: hist.max,
      avg: hist.sum / hist.count,
      p50: this._percentile(sorted, 0.5),
      p90: this._percentile(sorted, 0.9),
      p95: this._percentile(sorted, 0.95),
      p99: this._percentile(sorted, 0.99),
    };
  }

  /**
   * Get all metrics snapshot
   */
  snapshot() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries([...this.gauges.entries()].map(([k, v]) => [k, v.value])),
      histograms: Object.fromEntries([...this.histograms.entries()].map(([k, h]) => [
        k, { count: h.count, avg: h.sum / h.count, min: h.min, max: h.max }
      ])),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  _makeKey(name, tags) {
    const tagStr = Object.entries(tags).sort().map(([k, v]) => `${k}=${v}`).join(',');
    return tagStr ? `${name}{${tagStr}}` : name;
  }

  _percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, idx)];
  }

  _startFlush() {
    // Periodic cleanup of old histogram data
    setInterval(() => {
      for (const [key, hist] of this.histograms.entries()) {
        if (hist.values.length > this.maxSamples) {
          hist.values = hist.values.slice(-this.maxSamples);
        }
      }
    }, this.flushInterval);
  }
}

// ─── Health Check System ───────────────────────────────────────────────────

export class HealthChecker {
  constructor(options = {}) {
    this.checks = new Map();
    this.interval = options.intervalMs ?? 30_000;
    this.history = new Map(); // name → { status, lastCheck, history[] }
  }

  /**
   * Register a health check
   */
  register(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      timeout: options.timeoutMs ?? 5000,
      interval: options.intervalMs ?? this.interval,
      critical: options.critical ?? false,
    });
    this.history.set(name, { status: 'unknown', lastCheck: null, history: [] });
    return this;
  }

  /**
   * Run all health checks
   */
  async checkAll() {
    const results = [];

    for (const [name, check] of this.checks.entries()) {
      const result = await this._runCheck(name, check);
      results.push(result);
    }

    return {
      status: results.every(r => r.status === 'healthy') ? 'healthy' :
              results.some(r => r.status === 'critical') ? 'critical' : 'degraded',
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run a single health check
   */
  async check(name) {
    const check = this.checks.get(name);
    if (!check) return { status: 'unknown', error: `Check '${name}' not found` };
    return this._runCheck(name, check);
  }

  /**
   * Get health history
   */
  getHistory(name, limit = 10) {
    const hist = this.history.get(name);
    if (!hist) return [];
    return hist.history.slice(-limit);
  }

  async _runCheck(name, check) {
    const start = Date.now();
    let status = 'healthy';
    let message = '';
    let error = null;

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
      );
      const result = await Promise.race([check.fn(), timeoutPromise]);
      message = result?.message ?? 'OK';
      status = result?.status ?? 'healthy';
    } catch (err) {
      error = err.message;
      status = check.critical ? 'critical' : 'unhealthy';
      message = err.message;
    }

    const duration = Date.now() - start;
    const entry = { status, message, error, duration, checkedAt: new Date().toISOString() };

    // Update history
    const hist = this.history.get(name);
    if (hist) {
      hist.status = status;
      hist.lastCheck = entry.checkedAt;
      hist.history.push(entry);
      if (hist.history.length > 100) hist.history.shift();
    }

    return { name, ...entry };
  }
}

// ─── Alert conditions ──────────────────────────────────────────────────────
// Rules arrive over HTTP, so a condition is DATA, never source code. The API
// used to compile `new Function("metrics", body.conditionFn)`, which handed
// anyone with a dashboard session a shell inside the gateway process.

const CONDITION_OPERATORS = {
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
  "==": (a, b) => a === b,
  "!=": (a, b) => a !== b,
};

const CONDITION_SOURCES = ["counters", "gauges", "histograms"];
const HISTOGRAM_STATS = ["avg", "count", "min", "max"];

/**
 * Turn a declarative condition into an evaluator.
 *
 * @param {{source?: string, metric: string, stat?: string, op: string, value: number}} spec
 * @returns {(snapshot: object) => boolean}
 * @throws {Error} when the spec is not a valid condition
 */
export function compileCondition(spec) {
  if (!spec || typeof spec !== "object") throw new Error("condition must be an object");

  const source = String(spec.source || "counters");
  if (!CONDITION_SOURCES.includes(source)) {
    throw new Error(`condition.source must be one of: ${CONDITION_SOURCES.join(", ")}`);
  }

  const metric = String(spec.metric || "").trim();
  if (!metric) throw new Error("condition.metric is required");

  const op = String(spec.op || "");
  const compare = CONDITION_OPERATORS[op];
  if (!compare) {
    throw new Error(`condition.op must be one of: ${Object.keys(CONDITION_OPERATORS).join(" ")}`);
  }

  const value = Number(spec.value);
  if (!Number.isFinite(value)) throw new Error("condition.value must be a finite number");

  const stat = String(spec.stat || "avg");
  if (source === "histograms" && !HISTOGRAM_STATS.includes(stat)) {
    throw new Error(`condition.stat must be one of: ${HISTOGRAM_STATS.join(", ")}`);
  }

  return function evaluateCondition(snapshot) {
    const bucket = snapshot?.[source];
    if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, metric)) return false;
    const raw = bucket[metric];
    const current = source === "histograms" ? raw?.[stat] : raw;
    return Number.isFinite(current) ? compare(current, value) : false;
  };
}

// ─── Alert System ──────────────────────────────────────────────────────────

export class AlertManager {
  constructor(options = {}) {
    this.alerts = [];
    this.rules = [];
    this.silences = new Map(); // ruleId → expiry
    this.onAlert = options.onAlert ?? null;
  }

  /**
   * Add an alert rule
   */
  addRule(rule) {
    this.rules.push({
      id: rule.id ?? `rule_${Date.now()}`,
      name: rule.name,
      condition: rule.condition, // function(metrics) → boolean
      severity: rule.severity ?? 'warning',
      message: rule.message,
      cooldownMs: rule.cooldownMs ?? 300_000, // 5 min
      lastTriggered: null,
    });
    return this;
  }

  /**
   * Evaluate all rules against current metrics
   */
  evaluate(metrics) {
    const triggered = [];

    for (const rule of this.rules) {
      // Check if silenced
      const silenceExpiry = this.silences.get(rule.id);
      if (silenceExpiry && Date.now() < silenceExpiry) continue;

      // Check cooldown
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldownMs) continue;

      try {
        if (rule.condition(metrics)) {
          const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: rule.message,
            triggeredAt: new Date().toISOString(),
          };

          this.alerts.push(alert);
          rule.lastTriggered = Date.now();
          triggered.push(alert);

          if (this.onAlert) this.onAlert(alert);
        }
      } catch (err) {
        console.error(`[AlertManager] Rule '${rule.name}' evaluation error:`, err.message);
      }
    }

    return triggered;
  }

  /**
   * Get active alerts
   */
  getAlerts(severity = null, limit = 50) {
    let alerts = [...this.alerts];
    if (severity) alerts = alerts.filter(a => a.severity === severity);
    return alerts.slice(-limit);
  }

  /**
   * Silence a rule
   */
  silence(ruleId, durationMs = 3_600_000) {
    this.silences.set(ruleId, Date.now() + durationMs);
    return true;
  }

  /**
   * Clear an alert
   */
  clear(alertId) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    return true;
  }
}
