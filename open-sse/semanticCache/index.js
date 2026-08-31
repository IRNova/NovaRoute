// Semantic cache — embedding-indexed request cache backed by the `semanticCache`
// table (migration 003). All operations are fail-open: any DB/embedding error is
// treated as a cache miss and the request proceeds normally (cache is an
// optimization, never a correctness dependency).
//
// Safety rules (see isCacheableRequest):
//  - only non-streaming requests with no tools/tool_choice/tool history are cached
//  - the resolved (provider, model) is part of the key — no cross-model reuse
//  - TTL + maxEntries bound the table
import { createHash } from "crypto";
import { embed } from "../embeddings/index.js";

const memStore = new Map(); // id -> row

// ---------------------------------------------------------------------------
// Store access (SQLite via driver chain, in-memory fallback — same pattern as
// the routing predictor).
// ---------------------------------------------------------------------------
async function getStore() {
  try {
    const { getAdapter } = await import("@/lib/db/driver.js");
    const adapter = await getAdapter();
    if (adapter && typeof adapter.get === "function") {
      try {
        adapter.get(`SELECT COUNT(*) as c FROM semanticCache`);
        return { type: "db", adapter };
      } catch {
        return { type: "mem", map: memStore };
      }
    }
  } catch {
    /* no adapter */
  }
  return { type: "mem", map: memStore };
}

// ---------------------------------------------------------------------------
// Vector math
// ---------------------------------------------------------------------------
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---------------------------------------------------------------------------
// Key building / safety
// ---------------------------------------------------------------------------
export function messagesToText(body = {}) {
  const msgs = Array.isArray(body.messages)
    ? body.messages
    : Array.isArray(body.input)
      ? body.input
      : Array.isArray(body.contents)
        ? body.contents
        : [];
  const parts = [];
  for (const m of msgs) {
    if (!m) continue;
    const role = m.role || "user";
    let text = "";
    if (typeof m.content === "string") text = m.content;
    else if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (!b) continue;
        if (typeof b.text === "string") text += b.text + "\n";
        else if (typeof b.thinking === "string") text += b.thinking + "\n";
        else if (b.type === "image_url" || b.type === "image") text += "[image]\n";
      }
    } else if (Array.isArray(m.parts)) {
      for (const p of m.parts) {
        if (p && typeof p.text === "string") text += p.text + "\n";
      }
    }
    parts.push(`${role}: ${text}`);
  }
  return parts.join("\n").trim();
}

/** A request is cacheable only when tool state cannot affect the response. */
export function isCacheableRequest(body = {}) {
  if (!body || typeof body !== "object") return false;
  if (body.stream === true) return false;
  if (Array.isArray(body.tools) && body.tools.length > 0) return false;
  if (body.tool_choice) return false;
  const msgs = Array.isArray(body.messages) ? body.messages : Array.isArray(body.input) ? body.input : Array.isArray(body.contents) ? body.contents : [];
  for (const m of msgs) {
    if (!m) continue;
    if (m.role === "tool" || m.role === "function") return false;
    if (m.role === "assistant" && (Array.isArray(m.tool_calls) && m.tool_calls.length > 0)) return false;
  }
  return true;
}

/** Deterministic content hash used for exact-match fast path. */
export function buildCacheKey(body = {}, model) {
  const stable = {
    model,
    messages: (Array.isArray(body.messages) ? body.messages : Array.isArray(body.input) ? body.input : Array.isArray(body.contents) ? body.contents : [])
      .map((m) => (m && typeof m === "object" ? { role: m.role, content: m.content } : m)),
    temperature: body.temperature,
    top_p: body.top_p,
    max_tokens: body.max_tokens ?? body.max_completion_tokens,
    response_format: body.response_format,
  };
  return sha256(JSON.stringify(stable));
}

export function sha256(str) {
  return createHash("sha256").update(str).digest("hex");
}

function encodeEmbedding(v) {
  try { return JSON.stringify(v); } catch { return JSON.stringify([]); }
}

function decodeEmbedding(s) {
  try { return JSON.parse(s || "[]"); } catch { return []; }
}

function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------
/**
 * Look up a semantic cache hit.
 * Returns { hit: false } or { hit: true, responseBody, id, similarity, exact }.
 */
export async function lookup({ body, model, embedding, threshold = 0.85, maxCandidates = 200 }) {
  try {
    const store = await getStore();
    const now = nowIso();
    if (store.type === "db") {
      const key = buildCacheKey(body, model);
      const exact = store.adapter.get(
        `SELECT id, response FROM semanticCache
         WHERE model = ? AND requestHash = ? AND (expiresAt IS NULL OR expiresAt > ?)
         LIMIT 1`,
        [model, key, now]
      );
      if (exact) {
        return { hit: true, id: exact.id, responseBody: exact.response, similarity: 1, exact: true };
      }
      const rows = store.adapter.all(
        `SELECT id, requestHash, embedding, response FROM semanticCache
         WHERE model = ? AND (expiresAt IS NULL OR expiresAt > ?)
         ORDER BY created DESC LIMIT ?`,
        [model, now, maxCandidates]
      );
      let best = null;
      for (const row of rows) {
        const sim = cosineSimilarity(embedding, decodeEmbedding(row.embedding));
        if (sim >= threshold && (!best || sim > best.similarity)) {
          best = { id: row.id, responseBody: row.response, similarity: sim };
        }
      }
      return best ? { hit: true, ...best, exact: false } : { hit: false };
    }

    // memory fallback
    const key = buildCacheKey(body, model);
    let best = null;
    for (const row of store.map.values()) {
      if (row.model !== model) continue;
      if (row.expiresAt && row.expiresAt < now) continue;
      if (row.requestHash === key) {
        return { hit: true, id: row.id, responseBody: row.response, similarity: 1, exact: true };
      }
      const sim = cosineSimilarity(embedding, row.embedding || []);
      if (sim >= threshold && (!best || sim > best.similarity)) {
        best = { id: row.id, responseBody: row.response, similarity: sim };
      }
    }
    return best ? { hit: true, ...best, exact: false } : { hit: false };
  } catch {
    return { hit: false };
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export async function store({ body, model, endpoint, embedding, response, responseFormat = "openai", ttlMs = 72 * 3600 * 1000, expiresAt }) {
  try {
    const store = await getStore();
    const requestHash = buildCacheKey(body, model);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const created = nowIso();
    const expiresAtValue = expiresAt !== undefined ? expiresAt : (ttlMs > 0 ? nowIso(ttlMs) : null);
    if (store.type === "db") {
      store.adapter.run(
        `INSERT INTO semanticCache(id, model, endpoint, requestHash, embedding, response, responseFormat, stream, created, expiresAt, hits)
         VALUES(?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)`,
        [id, model, endpoint || null, requestHash, encodeEmbedding(embedding), response, responseFormat, created, expiresAtValue]
      );
    } else {
      store.map.set(id, {
        id, model, endpoint: endpoint || null, requestHash, embedding, response, responseFormat,
        created, expiresAt: expiresAtValue, hits: 0,
      });
    }
    return id;
  } catch {
    return null;
  }
}

export async function bumpHit(id) {
  if (!id) return;
  try {
    const store = await getStore();
    if (store.type === "db") {
      store.adapter.run(`UPDATE semanticCache SET hits = hits + 1 WHERE id = ?`, [id]);
    } else {
      const row = store.map.get(id);
      if (row) row.hits = (row.hits || 0) + 1;
    }
  } catch { /* fail-open */ }
}

// ---------------------------------------------------------------------------
// Maintenance / stats
// ---------------------------------------------------------------------------
export async function prune({ ttlMs = 72 * 3600 * 1000, maxEntries = 5000 } = {}) {
  try {
    const store = await getStore();
    let pruned = 0;
    if (store.type === "db") {
      const cutoff = nowIso(-ttlMs);
      const info = store.adapter.run(`DELETE FROM semanticCache WHERE expiresAt IS NOT NULL AND expiresAt < ?`, [cutoff]);
      pruned += info?.changes || 0;
      // Enforce cap: drop oldest rows beyond maxEntries.
      const total = store.adapter.get(`SELECT COUNT(*) as c FROM semanticCache`)?.c || 0;
      if (total > maxEntries) {
        const overflow = total - maxEntries;
        store.adapter.run(
          `DELETE FROM semanticCache WHERE id IN (SELECT id FROM semanticCache ORDER BY created ASC LIMIT ?)`,
          [overflow]
        );
        pruned += overflow;
      }
    } else {
      const cutoff = Date.now() - ttlMs;
      for (const [id, row] of store.map.entries()) {
        const exp = row.expiresAt ? new Date(row.expiresAt).getTime() : Infinity;
        if (exp < cutoff) { store.map.delete(id); pruned++; }
      }
      const rows = [...store.map.entries()].sort((a, b) => new Date(a[1].created) - new Date(b[1].created));
      while (rows.length > maxEntries) {
        store.map.delete(rows.shift()[0]);
        pruned++;
      }
    }
    return pruned;
  } catch {
    return 0;
  }
}

export async function getStats() {
  try {
    const store = await getStore();
    if (store.type === "db") {
      const total = store.adapter.get(`SELECT COUNT(*) as c FROM semanticCache`)?.c || 0;
      const hits = store.adapter.get(`SELECT COALESCE(SUM(hits), 0) as h FROM semanticCache`)?.h || 0;
      return { total, totalHits: hits };
    }
    let total = 0, hits = 0;
    for (const row of store.map.values()) {
      total++;
      hits += row.hits || 0;
    }
    return { total, totalHits: hits };
  } catch {
    return { total: 0, totalHits: 0 };
  }
}

export async function list({ limit = 50 } = {}) {
  try {
    const store = await getStore();
    if (store.type === "db") {
      return store.adapter.all(
        `SELECT id, model, endpoint, requestHash, created, expiresAt, hits 
         FROM semanticCache ORDER BY created DESC LIMIT ?`,
        [limit]
      );
    }
    return [...store.map.values()]
      .sort((a, b) => new Date(b.created) - new Date(a.created))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function deleteEntry(id) {
  try {
    const store = await getStore();
    if (store.type === "db") {
      const info = store.adapter.run(`DELETE FROM semanticCache WHERE id = ?`, [id]);
      return info?.changes || 0;
    }
    const existed = store.map.has(id);
    store.map.delete(id);
    return existed ? 1 : 0;
  } catch {
    return 0;
  }
}

export async function clear() {
  try {
    const store = await getStore();
    if (store.type === "db") {
      const info = store.adapter.run(`DELETE FROM semanticCache`);
      return info?.changes || 0;
    }
    const n = store.map.size;
    store.map.clear();
    return n;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// High-level helpers used by the request path
// ---------------------------------------------------------------------------
function cacheSettings(settings = {}) {
  const c = settings.semanticCache || {};
  return {
    enabled: c.enabled === true,
    threshold: typeof c.threshold === "number" ? c.threshold : 0.85,
    ttlMs: typeof c.ttlHours === "number" ? c.ttlHours * 3600 * 1000 : 72 * 3600 * 1000,
    maxEntries: typeof c.maxEntries === "number" ? c.maxEntries : 5000,
    maxResponseBytes: typeof c.maxResponseBytes === "number" ? c.maxResponseBytes : 1000000,
    lookupTimeoutMs: typeof c.lookupTimeoutMs === "number" ? c.lookupTimeoutMs : 3000,
  };
}

/** Skip caching entirely for local providers (no point caching a local model). */
export function isLocalProvider(provider = "") {
  return /ollama|lm-?studio|llama|local|kobold|lmstudio/i.test(String(provider));
}

/**
 * Try to serve a request from the semantic cache.
 * @returns {Promise<Response|null>} a cached Response on hit, or null on miss/error.
 */
export async function tryServeFromCache({ body, provider, model, settings }) {
  const cfg = cacheSettings(settings);
  if (!cfg.enabled) return null;
  if (isLocalProvider(provider)) return null;
  if (!isCacheableRequest(body)) return null;

  const text = messagesToText(body);
  if (!text) return null;

  try {
    const embedding = await withTimeout(embed(text, settings), cfg.lookupTimeoutMs);
    const result = await lookup({ body, model, embedding, threshold: cfg.threshold });
    if (result.hit) {
      bumpHit(result.id).catch(() => {});
      statDay("hits", Math.round(String(result.responseBody || "").length / 4)).catch(() => {});
      const cached = new Response(result.responseBody, {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "x-novaroute-cache": result.exact ? "exact" : "semantic", "x-novaroute-cache-similarity": result.similarity.toFixed(3) },
      });
      return cached;
    }
    statDay("misses").catch(() => {});
  } catch {
    /* embedding/lookup failed — cache miss */
  }
  return null;
}

// Daily hit/miss/token counters (kv "semanticStats") powering the dashboard
// trend charts. tokensSaved is estimated from cached response size (~4 chars/token).
async function statDay(kind, tokensDelta = 0) {
  try {
    const { makeKv } = await import("@/lib/db/helpers/kvStore.js");
    const kv = makeKv("semanticStats");
    const day = new Date().toISOString().slice(0, 10);
    const cur = (await kv.get(day, { hits: 0, misses: 0, tokensSaved: 0 })) || { hits: 0, misses: 0, tokensSaved: 0 };
    if (kind === "hits") {
      cur.hits += 1;
      cur.tokensSaved = (cur.tokensSaved || 0) + (Number(tokensDelta) || 0);
    } else {
      cur.misses += 1;
    }
    await kv.set(day, cur);
  } catch {}
}


/**
 * Store a successful non-streaming response into the semantic cache (fire-and-forget).
 */
export async function storeResponseInCache({ body, provider, model, responseBody, endpoint, settings }) {
  const cfg = cacheSettings(settings);
  if (!cfg.enabled) return;
  if (isLocalProvider(provider)) return;
  if (!isCacheableRequest(body)) return;
  if (!responseBody || responseBody.length > cfg.maxResponseBytes) return;

  const text = messagesToText(body);
  if (!text) return;

  try {
    const embedding = await withTimeout(embed(text, settings), cfg.lookupTimeoutMs);
    await store({ body, model, endpoint, embedding, response: responseBody, responseFormat: "openai", ttlMs: cfg.ttlMs });
    await prune({ ttlMs: cfg.ttlMs, maxEntries: cfg.maxEntries });
  } catch {
    /* fail-open */
  }
}

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
