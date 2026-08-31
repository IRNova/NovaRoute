// Nova Bot — Advanced capabilities ported from Hermes Agent.
// Todo lists, session search (FTS), clarification requests, fuzzy agent
// matching, error classification, checkpoint manager.

import { getAdapter } from "../db/driver.js";

let _ready = false;
async function ensureTables() {
  if (_ready) return;
  const db = await getAdapter();
  db.run(`CREATE TABLE IF NOT EXISTS nova_todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    task_id TEXT,
    content TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS nova_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    label TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  try {
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS nova_session_fts USING fts5(session_id, role, content)`);
  } catch { /* FTS5 unavailable — fallback to LIKE */ }
  _ready = true;
}

/* ── Todo / Checklist ───────────────────────────────────────────────── */

export async function addTodos(sessionId, taskId, items) {
  await ensureTables();
  const db = await getAdapter();
  const now = new Date().toISOString();
  for (const item of items) {
    db.run(
      `INSERT INTO nova_todos (session_id, task_id, content, created_at) VALUES (?, ?, ?, ?)`,
      [sessionId, taskId || null, String(item).slice(0, 500), now]
    );
  }
}

export async function completeTodo(id) {
  await ensureTables();
  const db = await getAdapter();
  db.run(`UPDATE nova_todos SET done = 1 WHERE id = ?`, [id]);
}

export async function getSessionTodos(sessionId) {
  await ensureTables();
  const db = await getAdapter();
  return db.all(
    `SELECT * FROM nova_todos WHERE session_id = ? ORDER BY id ASC`,
    [sessionId]
  );
}

export function formatTodoList(todos) {
  if (!todos.length) return "";
  return todos.map((t, i) => `${t.done ? "✓" : "○"} ${i + 1}. ${t.content}`).join("\n");
}

/* ── Session Search ─────────────────────────────────────────────────── */

export async function indexMessage(sessionId, role, content) {
  await ensureTables();
  const db = await getAdapter();
  try {
    db.run(`INSERT INTO nova_session_fts (session_id, role, content) VALUES (?, ?, ?)`,
      [sessionId, role, String(content).slice(0, 4000)]);
  } catch { /* best-effort indexing */ }
}

export async function searchSessions(query, limit = 10) {
  await ensureTables();
  const db = await getAdapter();
  try {
    // Try FTS5 first.
    const rows = db.all(
      `SELECT session_id, snippet(nova_session_fts, 2, '→', '←', '…', 24) as excerpt
       FROM nova_session_fts WHERE nova_session_fts MATCH ? LIMIT ?`,
      [String(query).replace(/["']/g, ""), limit]
    );
    if (rows.length) return rows;
  } catch { /* fall through to LIKE */ }

  // LIKE fallback.
  return db.all(
    `SELECT session_id, substr(content, 1, 200) as excerpt FROM nova_session_fts
     WHERE content LIKE ? LIMIT ?`,
    [`%${query}%`, limit]
  ).catch(() => []);
}

/* ── Fuzzy Agent Matching ───────────────────────────────────────────── */

/**
 * Levenshtein-based fuzzy match against available employee names.
 * Returns the best match if similarity ≥ threshold (0–1), else null.
 */
export function fuzzyMatchAgent(input, candidates, threshold = 0.55) {
  if (!input || !candidates?.length) return null;
  const needle = input.toLowerCase().trim();

  let best = null, bestScore = 0;
  for (const c of candidates) {
    const hay = c.toLowerCase().trim();
    let score;
    if (hay === needle) score = 1;
    else if (hay.includes(needle) || needle.includes(hay)) score = 0.85;
    else score = 1 - levenshtein(needle, hay) / Math.max(needle.length, hay.length);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= threshold ? best : null;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/* ── Clarification Detection ────────────────────────────────────────── */

const AMBIGUOUS_PATTERNS = [
  /^(چی|what|چیکار|چطور)\s/i,
  /\?$/.test("") ? null : /\b(fix|repair|improve|optimize|بهتر|درست|اصلاح)\b/i,
].filter(Boolean);

const TOO_SHORT_WORDS = 3;

/**
 * Detects whether the user's request is too ambiguous to act on directly.
 * Returns { needsClarify, question } or null.
 */
export function detectAmbiguity(userText) {
  const text = String(userText || "").trim();
  if (!text) return null;
  const words = text.split(/\s+/);
  if (words.length < TOO_SHORT_WORDS && !text.includes("?")) {
    return { needsClarify: true, question: `درخواستت خیلی کوتاهه. می‌تونی بیشتر توضیح بدی؟ «${text}» دقیقاً یعنی چی؟` };
  }
  for (const p of AMBIGUOUS_PATTERNS) {
    if (p.test(text)) return null; // questions are fine, they're explicit
  }
  return null;
}

/* ── Error Classifier ───────────────────────────────────────────────── */

const ERROR_MAP = [
  [/timeout|timed?\s*out|etimedout/i, "TIMEOUT", "Upstream didn't respond in time. Retry or switch provider."],
  [/econnrefused|enotfound|econnreset|network/i, "NETWORK", "Connection problem. Check internet / DNS / firewall."],
  [/40[13]|unauthorized|forbidden|invalid.?api.?key/i, "AUTH", "Credential invalid or expired. Re-authenticate."],
  [/429|rate.?limit|quota/i, "RATE_LIMIT", "Too many requests. Back off or use another account."],
  [/5\d\d|internal.?server/i, "UPSTREAM", "Provider-side failure. Usually transient."],
  [/json|parse|unexpected.?token/i, "PARSE", "Malformed response from model. Enable JSON repair."],
  [/memory|heap|oom/i, "MEMORY", "Out of memory. Reduce batch size or context length."],
];

export function classifyError(err) {
  const msg = String(err?.message || err || "");
  for (const [re, kind, hint] of ERROR_MAP) {
    if (re.test(msg)) return { kind, hint, raw: msg.slice(0, 300) };
  }
  return { kind: "UNKNOWN", hint: "Unclassified error.", raw: msg.slice(0, 300) };
}

/* ── Checkpoints ────────────────────────────────────────────────────── */

export async function saveCheckpoint(sessionId, label, snapshot) {
  await ensureTables();
  const db = await getAdapter();
  db.run(
    `INSERT INTO nova_checkpoints (session_id, label, snapshot, created_at) VALUES (?, ?, ?, ?)`,
    [sessionId, label, JSON.stringify(snapshot).slice(0, 100000), new Date().toISOString()]
  );
}

export async function latestCheckpoint(sessionId) {
  await ensureTables();
  const db = await getAdapter();
  const row = db.get(
    `SELECT snapshot FROM nova_checkpoints WHERE session_id = ? ORDER BY id DESC LIMIT 1`,
    [sessionId]
  );
  try { return row ? JSON.parse(row.snapshot) : null; } catch { return null; }
}
