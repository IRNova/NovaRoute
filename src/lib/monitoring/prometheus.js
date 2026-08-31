// Prometheus text exposition for the gateway.
//
// Everything here is derived from data the gateway already persists
// (usageHistory) plus live process state, so scraping costs one aggregate
// query and never touches the request path.
//
// Format: https://prometheus.io/docs/instrumenting/exposition_formats/

import { getAdapter } from "@/lib/db/driver.js";
import { listKeyRateStates } from "@/lib/security/keyRateLimiter.js";

const PREFIX = "novaroute";

/** Escape a Prometheus label value. */
function labelValue(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function metricLine(name, labels, value) {
  const pairs = Object.entries(labels || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}="${labelValue(v)}"`)
    .join(",");
  return `${name}${pairs ? `{${pairs}}` : ""} ${Number.isFinite(value) ? value : 0}`;
}

function section(lines, { name, help, type, rows }) {
  if (!rows.length) return;
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} ${type}`);
  lines.push(...rows);
}

const SINCE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Build the exposition body.
 * @returns {Promise<string>}
 */
export async function renderPrometheusMetrics() {
  const lines = [];
  const now = Date.now();

  // ── process ────────────────────────────────────────────────────────
  const memory = process.memoryUsage();
  section(lines, {
    name: `${PREFIX}_up`,
    help: "1 when the gateway process is serving.",
    type: "gauge",
    rows: [metricLine(`${PREFIX}_up`, {}, 1)],
  });
  section(lines, {
    name: `${PREFIX}_process_uptime_seconds`,
    help: "Seconds since the gateway process started.",
    type: "gauge",
    rows: [metricLine(`${PREFIX}_process_uptime_seconds`, {}, Math.floor(process.uptime()))],
  });
  section(lines, {
    name: `${PREFIX}_process_memory_bytes`,
    help: "Resident and heap memory of the gateway process.",
    type: "gauge",
    rows: [
      metricLine(`${PREFIX}_process_memory_bytes`, { kind: "rss" }, memory.rss),
      metricLine(`${PREFIX}_process_memory_bytes`, { kind: "heap_used" }, memory.heapUsed),
    ],
  });

  // ── usage, from the persisted history ──────────────────────────────
  let db;
  try {
    db = await getAdapter();
  } catch {
    lines.push("");
    return lines.join("\n");
  }

  const sinceIso = new Date(now - SINCE_WINDOW_MS).toISOString();

  const byModel = safeAll(
    db,
    `SELECT provider, model, status,
            COUNT(*) AS requests,
            COALESCE(SUM(promptTokens), 0) AS promptTokens,
            COALESCE(SUM(completionTokens), 0) AS completionTokens,
            COALESCE(SUM(cost), 0) AS cost
       FROM usageHistory
      WHERE timestamp >= ?
      GROUP BY provider, model, status`,
    [sinceIso]
  );

  const requestRows = [];
  const tokenRows = [];
  const costRows = [];
  for (const row of byModel) {
    const labels = { provider: row.provider || "unknown", model: row.model || "unknown" };
    const outcome = String(row.status || "").toLowerCase() === "error" ? "error" : "success";
    requestRows.push(metricLine(`${PREFIX}_requests_total`, { ...labels, outcome }, row.requests));
    tokenRows.push(metricLine(`${PREFIX}_tokens_total`, { ...labels, direction: "prompt" }, row.promptTokens));
    tokenRows.push(metricLine(`${PREFIX}_tokens_total`, { ...labels, direction: "completion" }, row.completionTokens));
    costRows.push(metricLine(`${PREFIX}_cost_usd_total`, labels, round(row.cost)));
  }

  section(lines, {
    name: `${PREFIX}_requests_total`,
    help: "Gateway requests in the last 24h, by provider, model and outcome.",
    type: "counter",
    rows: requestRows,
  });
  section(lines, {
    name: `${PREFIX}_tokens_total`,
    help: "Prompt and completion tokens in the last 24h.",
    type: "counter",
    rows: tokenRows,
  });
  section(lines, {
    name: `${PREFIX}_cost_usd_total`,
    help: "Spend in USD in the last 24h, by provider and model.",
    type: "counter",
    rows: costRows,
  });

  // ── keys ───────────────────────────────────────────────────────────
  const keyRows = safeAll(
    db,
    `SELECT k.id AS id, k.name AS name,
            COALESCE(SUM(u.cost), 0) AS cost,
            COUNT(u.id) AS requests
       FROM apiKeys k
       LEFT JOIN usageHistory u ON u.apiKey = k.key AND u.timestamp >= ?
      WHERE k.isActive != 0
      GROUP BY k.id, k.name`,
    [sinceIso]
  );

  section(lines, {
    name: `${PREFIX}_key_requests_total`,
    help: "Requests per API key in the last 24h.",
    type: "counter",
    rows: keyRows.map((r) => metricLine(`${PREFIX}_key_requests_total`, { key: r.name || r.id }, r.requests)),
  });
  section(lines, {
    name: `${PREFIX}_key_cost_usd_total`,
    help: "Spend per API key in the last 24h.",
    type: "counter",
    rows: keyRows.map((r) => metricLine(`${PREFIX}_key_cost_usd_total`, { key: r.name || r.id }, round(r.cost))),
  });

  const rateStates = listKeyRateStates(now);
  const keyNames = new Map(keyRows.map((r) => [r.id, r.name || r.id]));
  section(lines, {
    name: `${PREFIX}_key_requests_current_minute`,
    help: "Requests counted against each key's per-minute limit right now.",
    type: "gauge",
    rows: rateStates.map((s) =>
      metricLine(`${PREFIX}_key_requests_current_minute`, { key: keyNames.get(s.keyId) || s.keyId }, s.used)
    ),
  });
  section(lines, {
    name: `${PREFIX}_key_requests_in_flight`,
    help: "Requests currently in flight per key.",
    type: "gauge",
    rows: rateStates.map((s) =>
      metricLine(`${PREFIX}_key_requests_in_flight`, { key: keyNames.get(s.keyId) || s.keyId }, s.active)
    ),
  });

  // ── providers ──────────────────────────────────────────────────────
  const connections = safeAll(db, `SELECT data FROM providerConnections`, []);
  let active = 0;
  let inactive = 0;
  for (const row of connections) {
    let parsed = null;
    try {
      parsed = JSON.parse(row.data || "{}");
    } catch { /* skip unparseable row */ }
    if (parsed && parsed.isActive !== false) active += 1;
    else inactive += 1;
  }
  section(lines, {
    name: `${PREFIX}_provider_connections`,
    help: "Configured provider connections by state.",
    type: "gauge",
    rows: [
      metricLine(`${PREFIX}_provider_connections`, { state: "active" }, active),
      metricLine(`${PREFIX}_provider_connections`, { state: "inactive" }, inactive),
    ],
  });

  lines.push("");
  return lines.join("\n");
}

function safeAll(db, sql, params) {
  try {
    return db.all(sql, params) || [];
  } catch {
    return [];
  }
}

function round(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}
