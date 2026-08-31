// Predictive layer for adaptive routing.
// Persists per (taskType, provider, model) rolling performance into the SQLite
// routingStats table. Fail-open everywhere: any storage error is swallowed and
// the routing flow continues (RTK convention — never throw out of a hook).
import { TASK_TYPES } from "../config/routingConfig.js";

// In-memory fallback so tests / standalone usage never crash without the DB.
const memStore = new Map();

async function getStore() {
  try {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const adapter = await getAdapter();
    if (adapter && typeof adapter.get === "function") {
      // Validate the table exists; otherwise fall back to memory.
      try {
        adapter.get(`SELECT COUNT(*) as c FROM routingStats`);
        return { type: "db", adapter };
      } catch {
        return { type: "mem", map: memStore };
      }
    }
  } catch {
    /* no adapter available */
  }
  return { type: "mem", map: memStore };
}

function memKey(taskType, provider, model) {
  return `${taskType}|${provider}|${model}`;
}

/**
 * Record one completed request into routingStats (upsert).
 * All fields optional except provider/model. Never throws.
 */
export async function recordRequest({ taskType = TASK_TYPES.GENERAL, provider, model, success = true, latencyMs = 0, promptTokens = 0, completionTokens = 0, cost = 0 }) {
  if (!provider || !model) return;
  const key = taskType || TASK_TYPES.GENERAL;
  const now = new Date().toISOString();
  try {
    const store = await getStore();
    if (store.type === "db") {
      store.adapter.run(
        `INSERT INTO routingStats(taskType, provider, model, samples, success, totalLatencyMs, totalPromptTokens, totalCompletionTokens, totalCost, lastUsed, updatedAt)
         VALUES(?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(taskType, provider, model) DO UPDATE SET
           samples = samples + 1,
           success = success + excluded.success,
           totalLatencyMs = totalLatencyMs + excluded.totalLatencyMs,
           totalPromptTokens = totalPromptTokens + excluded.totalPromptTokens,
           totalCompletionTokens = totalCompletionTokens + excluded.totalCompletionTokens,
           totalCost = totalCost + excluded.totalCost,
           lastUsed = excluded.lastUsed,
           updatedAt = excluded.updatedAt`,
        [key, provider, model, success ? 1 : 0, latencyMs || 0, promptTokens || 0, completionTokens || 0, cost || 0, now, now]
      );
      // Hourly timeline (observability heatmap) — fail-open, separate table.
      const hour = now.slice(0, 13) + ":00";
      try {
        store.adapter.run(
          `INSERT INTO routingTimeline(hour, taskType, provider, model, requests, failures, totalLatencyMs)
           VALUES(?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(hour, taskType, provider, model) DO UPDATE SET
             requests = requests + 1,
             failures = failures + excluded.failures,
             totalLatencyMs = totalLatencyMs + excluded.totalLatencyMs`,
          [hour, key, provider, model, success ? 0 : 1, latencyMs || 0]
        );
      } catch {
        /* timeline table may be absent on very old DBs — fail-open */
      }
      return;
    }
    const k = memKey(key, provider, model);
    const cur = store.map.get(k) || { samples: 0, success: 0, totalLatencyMs: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalCost: 0 };
    cur.samples += 1;
    cur.success += success ? 1 : 0;
    cur.totalLatencyMs += latencyMs || 0;
    cur.totalPromptTokens += promptTokens || 0;
    cur.totalCompletionTokens += completionTokens || 0;
    cur.totalCost += cost || 0;
    cur.lastUsed = now;
    store.map.set(k, cur);
  } catch {
    /* fail-open */
  }
}

/**
 * Record a failed request (no usage data available). Increments samples only,
 * so the success-rate signal stays accurate even when upstream dies pre-tokens.
 */
export async function recordFailure({ taskType = TASK_TYPES.GENERAL, provider, model, latencyMs = 0 }) {
  if (!provider || !model) return;
  await recordRequest({ taskType, provider, model, success: false, latencyMs, promptTokens: 0, completionTokens: 0, cost: 0 });
}

/**
 * Read aggregated per-model stats for a task type.
 * @returns {Promise<Array<{provider, model, samples, successRate, avgLatencyMs, avgPromptTokens, avgCompletionTokens, avgCost}>>}
 */
export async function getModelStats(taskType) {
  try {
    const store = await getStore();
    if (store.type === "db") {
      const rows = store.adapter.all(
        `SELECT provider, model, samples, success, totalLatencyMs, totalPromptTokens, totalCompletionTokens, totalCost
         FROM routingStats WHERE taskType = ?`,
        [taskType]
      );
      return rows.map((r) => ({
        provider: r.provider,
        model: r.model,
        samples: r.samples || 0,
        successRate: r.samples > 0 ? r.success / r.samples : 0,
        avgLatencyMs: r.samples > 0 ? r.totalLatencyMs / r.samples : 0,
        avgPromptTokens: r.samples > 0 ? Math.round(r.totalPromptTokens / r.samples) : 0,
        avgCompletionTokens: r.samples > 0 ? Math.round(r.totalCompletionTokens / r.samples) : 0,
        avgCost: r.samples > 0 ? r.totalCost / r.samples : 0,
      }));
    }
    const out = [];
    for (const [k, cur] of store.map.entries()) {
      const [tk, provider, model] = k.split("|");
      if (tk !== taskType) continue;
      out.push({
        provider, model,
        samples: cur.samples || 0,
        successRate: cur.samples > 0 ? cur.success / cur.samples : 0,
        avgLatencyMs: cur.samples > 0 ? cur.totalLatencyMs / cur.samples : 0,
        avgPromptTokens: cur.samples > 0 ? Math.round(cur.totalPromptTokens / cur.samples) : 0,
        avgCompletionTokens: cur.samples > 0 ? Math.round(cur.totalCompletionTokens / cur.samples) : 0,
        avgCost: cur.samples > 0 ? cur.totalCost / cur.samples : 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Map of stats keyed by "provider|model" for O(1) lookup by the scorer. */
export async function getStatsMap(taskType) {
  const stats = await getModelStats(taskType);
  const map = {};
  for (const s of stats) map[`${s.provider}|${s.model}`] = s;
  return map;
}

/** Summary for the dashboard (routing stats endpoint). */
export async function getStatsSummary() {
  try {
    const store = await getStore();
    let rows;
    if (store.type === "db") {
      rows = store.adapter.all(
        `SELECT taskType, provider, model, samples, success, totalLatencyMs, totalPromptTokens, totalCompletionTokens, totalCost, lastUsed
         FROM routingStats ORDER BY samples DESC LIMIT 500`
      );
    } else {
      rows = [...store.map.entries()].map(([k, cur]) => {
        const [taskType, provider, model] = k.split("|");
        return { taskType, provider, model, ...cur };
      });
    }
    return rows.map((r) => ({
      taskType: r.taskType,
      provider: r.provider,
      model: r.model,
      samples: r.samples || 0,
      success: r.success || 0,
      successRate: r.samples > 0 ? (r.success || 0) / r.samples : 0,
      avgLatencyMs: r.samples > 0 ? r.totalLatencyMs / r.samples : 0,
      avgPromptTokens: r.samples > 0 ? Math.round(r.totalPromptTokens / r.samples) : 0,
      avgCompletionTokens: r.samples > 0 ? Math.round(r.totalCompletionTokens / r.samples) : 0,
      avgCost: r.samples > 0 ? r.totalCost / r.samples : 0,
      lastUsed: r.lastUsed,
    }));
  } catch {
    return [];
  }
}

/** Prune old rows (default: keep last 90 days) and drop zero-sample debris. */
export async function pruneRoutingStats(maxAgeDays = 90) {
  try {
    const store = await getStore();
    if (store.type !== "db") return 0;
    const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString();
    const info = store.adapter.run(
      `DELETE FROM routingStats WHERE updatedAt < ? OR samples <= 0`,
      [cutoff]
    );
    try {
      store.adapter.run(`DELETE FROM routingTimeline WHERE hour < ?`, [cutoff.slice(0, 13) + ":00"]);
    } catch {
      /* timeline table may be absent — fail-open */
    }
    return info?.changes || 0;
  } catch {
    return 0;
  }
}

/**
 * Hourly timeline rows for observability heatmaps (last N hours).
 * @param {number} hours - how many hours back (default 24)
 * @returns {Promise<Array<{hour, taskType, provider, model, requests, failures, successRate, avgLatencyMs}>>}
 */
export async function getTimeline(hours = 24) {
  try {
    const store = await getStore();
    if (store.type !== "db") {
      return [...store.map.entries()].map(([k, cur]) => {
        const [taskType, provider, model] = k.split("|");
        return {
          hour: new Date().toISOString().slice(0, 13) + ":00",
          taskType, provider, model,
          requests: cur.samples || 0,
          failures: (cur.samples || 0) - (cur.success || 0),
          successRate: cur.samples > 0 ? (cur.success || 0) / cur.samples : 0,
          avgLatencyMs: cur.samples > 0 ? cur.totalLatencyMs / cur.samples : 0,
        };
      });
    }
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString().slice(0, 13) + ":00";
    const rows = store.adapter.all(
      `SELECT hour, taskType, provider, model, requests, failures, totalLatencyMs
       FROM routingTimeline WHERE hour >= ? ORDER BY hour DESC LIMIT 2000`,
      [cutoff]
    );
    return rows.map((r) => ({
      hour: r.hour,
      taskType: r.taskType,
      provider: r.provider,
      model: r.model,
      requests: r.requests || 0,
      failures: r.failures || 0,
      successRate: r.requests > 0 ? 1 - (r.failures || 0) / r.requests : 0,
      avgLatencyMs: r.requests > 0 ? r.totalLatencyMs / r.requests : 0,
    }));
  } catch {
    return [];
  }
}
