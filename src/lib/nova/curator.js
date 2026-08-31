// Nova Bot — memory curator, insights engine & model pricing.
// Ported from Hermes Agent's curator/insights/usage_pricing concepts.

import { getAdapter } from "../db/driver.js";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("novaInsights");

/* ── Memory curation ───────────────────────────────────────────────── */

function tokens(text) {
  return new Set(String(text || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3));
}

function jaccard(aSet, bSet) {
  const inter = [...aSet].filter((x) => bSet.has(x)).length;
  const uni = aSet.size + bSet.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

/**
 * Dedupe near-identical learned skills (Jaccard ≥ .82): keeps the older,
 * higher-usage entry and deletes duplicates. Returns removed count.
 */
export async function curateMemories() {
  const db = await getAdapter();
  db.run(`CREATE TABLE IF NOT EXISTS nova_memory_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    a_id INTEGER NOT NULL,
    b_id INTEGER NOT NULL,
    score REAL NOT NULL
  )`);
  const rows = db.all(`SELECT id, skill_name, content, usage_count FROM nova_memory ORDER BY usage_count DESC, created_at ASC`);
  const removed = [];
  const kept = [];
  for (const row of rows) {
    const t = tokens(row.content);
    const dup = kept.find((k) => k.sim === row.skill_name && jaccard(k.t, t) >= 0.82);
    if (dup) removed.push(row.id);
    else kept.push({ ...row, t });
  }
  for (const id of removed) db.run(`DELETE FROM nova_memory WHERE id = ?`, [id]);

  // Cap the library: drop lowest-value entries beyond 400.
  db.run(`DELETE FROM nova_memory WHERE id NOT IN (
    SELECT id FROM nova_memory ORDER BY usage_count DESC, created_at DESC LIMIT 400
  )`);

  // Build related-links graph: pairs related but not duplicates.
  try {
    db.run(`DELETE FROM nova_memory_links`);
    for (let i = 0; i < kept.length; i++) {
      for (let j = i + 1; j < kept.length; j++) {
        const score = jaccard(kept[i].t, kept[j].t);
        if (score >= 0.45 && score < 0.82) {
          db.run(`INSERT INTO nova_memory_links (a_id, b_id, score) VALUES (?, ?, ?)`,
            [kept[i].id, kept[j].id, Number(score.toFixed(3))]);
        }
        if (i > 120) break; // cap O(n²) work
      }
    }
  } catch { /* links best-effort */ }

  await kv.set("lastCurated", new Date().toISOString());
  return { removed: removed.length };
}

/* ── Model pricing (static, per 1M tokens USD) ─────────────────────── */

export const MODEL_PRICING = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  o3: { in: 10, out: 40 },
  "o4-mini": { in: 1.1, out: 4.4 },
  "claude-opus-4": { in: 15, out: 75 },
  "claude-sonnet-4": { in: 3, out: 15 },
  "claude-3-7-sonnet": { in: 3, out: 15 },
  "claude-3-5-haiku": { in: 0.8, out: 4 },
  "gemini-2.5-pro": { in: 1.25, out: 10 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "deepseek-chat": { in: 0.27, out: 1.1 },
  "deepseek-reasoner": { in: 0.55, out: 2.19 },
  "qwen-max": { in: 1.6, out: 6.4 },
  "glm-4-plus": { in: 6.5, out: 6.5 },
};

/** Rough cost in USD; unknown models estimate with sonnet-class rates. */
export function estimateCost(model, inTokens, outTokens) {
  const key = Object.keys(MODEL_PRICING).find((k) => String(model || "").includes(k));
  const rate = MODEL_PRICING[key] || MODEL_PRICING["claude-sonnet-4"];
  return ((inTokens * rate.in + outTokens * rate.out) / 1_000_000);
}

/* ── Insights snapshot ─────────────────────────────────────────────── */

/**
 * Aggregate usage + agent stats into a compact snapshot stored in kv.
 * Cheap enough to run on the cron ticker daily.
 */
export async function captureInsights() {
  const db = await getAdapter();
  let usage = null;
  try {
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    usage = db.get(
      `SELECT COUNT(*) as calls, COALESCE(SUM(prompt_tokens),0) as p, COALESCE(SUM(completion_tokens),0) as c
       FROM usage WHERE created_at >= ?`,
      [dayAgo]
    );
  } catch { /* usage table may not exist in tests */ }

  let agents = null;
  try {
    agents = db.all(`SELECT name, role, tasksDone FROM nova_agents ORDER BY tasksDone DESC LIMIT 5`);
  } catch { /* ignore */ }

  let topSkills = [];
  try {
    topSkills = db.all(`SELECT skill_name, usage_count FROM nova_memory ORDER BY usage_count DESC LIMIT 5`);
  } catch { /* ignore */ }

  const snapshot = {
    at: new Date().toISOString(),
    calls24h: usage?.calls || 0,
    tokens24h: { in: usage?.p || 0, out: usage?.c || 0 },
    estCost24hUsd: usage ? Number(estimateCost("claude-sonnet-4", usage.p, usage.c).toFixed(4)) : 0,
    topAgents: agents || [],
    topSkills,
  };
  await kv.set("latest", snapshot);

  // Daily rollup ring (keep 30).
  const rolls = (await kv.get("rollups", [])) || [];
  const dayKey = new Date().toISOString().slice(0, 10);
  if (!rolls.length || rolls[0].day !== dayKey) rolls.unshift({ day: dayKey, ...snapshot });
  else rolls[0] = { day: dayKey, ...snapshot };
  await kv.set("rollups", rolls.slice(0, 30));

  return snapshot;
}

/* ── Live model catalog (models.dev) ─────────────────────────────── */

export async function refreshModelsDev() {
  try {
    const res = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const data = await res.json();
    await kv.set("modelsDev", { at: new Date().toISOString(), providers: Object.keys(data || {}).length });
    return true;
  } catch {
    return false;
  }
}
