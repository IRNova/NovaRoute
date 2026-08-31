// Token Saver (RTK) savings ledger — JSONL append per request, rotated at 5MB,
// aggregated by the /api/rtk/stats route. Fire-and-forget: never breaks traffic.
import fs from "fs";
import path from "path";
import { DATA_DIR } from "../dataDir.js";

const RTK_STATS_DIR = path.join(DATA_DIR, "rtk");
const EVENTS_FILE = path.join(RTK_STATS_DIR, "events.jsonl");
const ROTATED_FILE = path.join(RTK_STATS_DIR, "events.jsonl.1");
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

function ensureDir() {
  if (!fs.existsSync(RTK_STATS_DIR)) fs.mkdirSync(RTK_STATS_DIR, { recursive: true });
}

export function appendRtkEvent(event) {
  try {
    ensureDir();
    try {
      const stat = fs.statSync(EVENTS_FILE);
      if (stat.size > MAX_FILE_BYTES) fs.renameSync(EVENTS_FILE, ROTATED_FILE);
    } catch { /* no file yet */ }
    fs.appendFile(EVENTS_FILE, JSON.stringify({ ts: Date.now(), ...event }) + "\n", () => {});
  } catch { /* ignore */ }
}

export function readRtkEvents({ sinceMs = null } = {}) {
  const events = [];
  for (const file of [ROTATED_FILE, EVENTS_FILE]) {
    try {
      if (!fs.existsSync(file)) continue;
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        if (!line) continue;
        try {
          const ev = JSON.parse(line);
          if (sinceMs && ev.ts < sinceMs) continue;
          events.push(ev);
        } catch { /* skip corrupt line */ }
      }
    } catch { /* ignore */ }
  }
  return events;
}

const emptyTotals = () => ({
  requests: 0,
  compressedRequests: 0,
  charsBefore: 0,
  charsAfter: 0,
  charsSaved: 0,
  savedPct: 0,
});

// Rough token/cost estimation: ~4 chars per token, priced at the average
// blended input rate (override with RTK_EST_PRICE_PER_MTOK, USD per 1M tokens).
function estimate(charsSaved) {
  const tokens = Math.round(charsSaved / 4);
  const pricePerMTok = Number(process.env.RTK_EST_PRICE_PER_MTOK) || 0.5;
  const usd = (tokens / 1_000_000) * pricePerMTok;
  return { tokensSavedEst: tokens, usdSavedEst: Math.round(usd * 10000) / 10000 };
}

function bucketTotals(events) {
  const t = emptyTotals();
  for (const ev of events) {
    t.requests += 1;
    const before = Number(ev.bytesBefore) || 0;
    const after = Number(ev.bytesAfter) || 0;
    if (after < before) {
      t.compressedRequests += 1;
      t.charsBefore += before;
      t.charsAfter += after;
      t.charsSaved += before - after;
    }
  }
  t.savedPct = t.charsBefore > 0 ? Math.round((t.charsSaved / t.charsBefore) * 1000) / 10 : 0;
  return { ...t, ...estimate(t.charsSaved) };
}

export function getRtkStats() {
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);

  // Timeline is capped at the newest 30 days present in the file.
  const all = readRtkEvents({ sinceMs: now - 30 * DAY_MS });

  const daily = [];
  const byDay = new Map();
  for (const ev of all) {
    const day = new Date(ev.ts).setHours(0, 0, 0, 0);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(ev);
  }
  for (const [day, evs] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const totals = bucketTotals(evs);
    daily.push({
      date: new Date(day).toISOString().slice(0, 10),
      requests: totals.requests,
      charsSaved: totals.charsSaved,
      tokensSavedEst: totals.tokensSavedEst,
      usdSavedEst: totals.usdSavedEst,
      savedPct: totals.savedPct,
    });
  }

  const byProviderMap = new Map();
  for (const ev of all) {
    const key = ev.provider || "unknown";
    if (!byProviderMap.has(key)) byProviderMap.set(key, []);
    byProviderMap.get(key).push(ev);
  }
  const providers = [...byProviderMap.entries()]
    .map(([provider, evs]) => ({ provider, ...bucketTotals(evs) }))
    .sort((a, b) => b.charsSaved - a.charsSaved)
    .slice(0, 10)
    .map(({ provider, ...totals }) => ({ provider, ...totals }));

  return {
    allTime: bucketTotals(all),
    today: bucketTotals(all.filter((e) => e.ts >= todayStart)),
    last7d: bucketTotals(all.filter((e) => e.ts >= now - 7 * DAY_MS)),
    daily,
    providers,
    estPricePerMTok: Number(process.env.RTK_EST_PRICE_PER_MTOK) || 0.5,
  };
}
