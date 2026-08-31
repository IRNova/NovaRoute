// Recall over the agent's own memory (learned skills + notes).
//
// The first implementation matched with `content LIKE %word%` joined by OR:
// any single common word pulled a row in, and results came back newest-first
// with no notion of relevance. This adds an FTS5 index with BM25 ranking —
// the same approach Hermes Agent uses — and keeps the LIKE path as a fallback
// for SQLite builds without FTS5 (sql.js in the driver chain may lack it).
//
// No app imports: the database adapter is passed in, so this is unit-testable.

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "was", "are", "you", "your",
  "has", "can", "not", "but", "its", "our", "out", "who", "all", "she", "how", "may",
  "say", "new", "now", "old", "see", "two", "way", "her", "him", "one", "use", "man",
  "day", "too", "any", "get", "put", "end", "try", "what", "when", "where", "which",
  "into", "about", "would", "could", "should", "than", "then", "them", "they",
]);

/** Pull the terms worth searching on out of free text. */
export function extractTerms(text, max = 8) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, max);
}

/** Build an FTS5 MATCH expression. Terms are quoted so punctuation can't inject syntax. */
export function buildMatchQuery(terms) {
  return terms.map((t) => `"${t.replace(/"/g, "")}"`).filter((t) => t !== '""').join(" OR ");
}

let rebuiltThisProcess = false;

/** Test seam: forget that the index was rebuilt in this process. */
export function __resetIndexStateForTests() {
  rebuiltThisProcess = false;
}

/**
 * Create the FTS5 index and its sync triggers. Returns false when this SQLite
 * build has no FTS5 — callers then use the LIKE path.
 */
export function ensureMemoryIndex(db) {
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS nova_memory_fts
             USING fts5(content, content='nova_memory', content_rowid='id')`);
    db.exec(`CREATE TRIGGER IF NOT EXISTS nova_memory_ai AFTER INSERT ON nova_memory BEGIN
               INSERT INTO nova_memory_fts(rowid, content) VALUES (new.id, new.content);
             END`);
    db.exec(`CREATE TRIGGER IF NOT EXISTS nova_memory_ad AFTER DELETE ON nova_memory BEGIN
               INSERT INTO nova_memory_fts(nova_memory_fts, rowid, content) VALUES('delete', old.id, old.content);
             END`);
    db.exec(`CREATE TRIGGER IF NOT EXISTS nova_memory_au AFTER UPDATE ON nova_memory BEGIN
               INSERT INTO nova_memory_fts(nova_memory_fts, rowid, content) VALUES('delete', old.id, old.content);
               INSERT INTO nova_memory_fts(rowid, content) VALUES (new.id, new.content);
             END`);
    // Backfill rows written before the index existed. An external-content FTS5
    // table proxies COUNT(*) to the content table, so it cannot report whether
    // the index itself is populated — rebuild once per process instead. Agent
    // memory is small (hundreds of rows), so this costs milliseconds at boot
    // and self-heals an index that drifted.
    if (!rebuiltThisProcess) {
      rebuiltThisProcess = true;
      db.exec(`INSERT INTO nova_memory_fts(nova_memory_fts) VALUES('rebuild')`);
    }
    return true;
  } catch {
    return false; // no FTS5 in this build
  }
}

/**
 * Relevance-ranked recall.
 *
 * @param {object} db      database adapter (get/all/run/exec)
 * @param {object} options
 * @param {string} options.agentName  agent whose memory to search ("" = any)
 * @param {string} options.text       the user's message
 * @param {number} [options.limit]    max snippets
 * @returns {{ rows: Array<{content: string, kind: string}>, engine: "fts5"|"like" }}
 */
export function searchMemories(db, { agentName = "", text = "", limit = 5 } = {}) {
  const terms = extractTerms(text);
  if (!terms.length) return { rows: [], engine: "none" };

  const agentPattern = `%${agentName}%`;

  if (ensureMemoryIndex(db)) {
    const match = buildMatchQuery(terms);
    if (match) {
      try {
        const rows = db.all(
          `SELECT m.content AS content, m.kind AS kind
             FROM nova_memory_fts f
             JOIN nova_memory m ON m.id = f.rowid
            WHERE nova_memory_fts MATCH ?
              AND m.agent_name LIKE ?
            ORDER BY CASE WHEN m.kind = 'skill' THEN 0 ELSE 1 END,
                     bm25(nova_memory_fts)
            LIMIT ?`,
          [match, agentPattern, limit]
        );
        if (rows && rows.length) return { rows, engine: "fts5" };
        // An empty FTS result is a real answer, not a failure.
        return { rows: [], engine: "fts5" };
      } catch {
        // fall through to LIKE
      }
    }
  }

  // Fallback: LIKE, but ranked by how many terms a row matches instead of
  // "newest row containing any word".
  try {
    const score = terms.map(() => `(CASE WHEN lower(content) LIKE ? THEN 1 ELSE 0 END)`).join(" + ");
    const conditions = terms.map(() => `lower(content) LIKE ?`).join(" OR ");
    const likeParams = terms.map((t) => `%${t}%`);
    const rows = db.all(
      `SELECT content, kind, (${score}) AS hits
         FROM nova_memory
        WHERE agent_name LIKE ? AND (${conditions})
        ORDER BY hits DESC, CASE WHEN kind = 'skill' THEN 0 ELSE 1 END, created_at DESC
        LIMIT ?`,
      [...likeParams, agentPattern, ...likeParams, limit]
    );
    return { rows: rows || [], engine: "like" };
  } catch {
    return { rows: [], engine: "none" };
  }
}
