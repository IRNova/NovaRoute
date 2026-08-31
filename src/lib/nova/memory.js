// Nova Bot — persistent learning & cross-session memory.
// Skills: after each completed task the employee model summarizes what it
// learned; that summary is stored and injected into future prompts so the
// agent improves over time without re-training.
//
// Memory: before building prompts we search past session messages (LIKE-based,
// no FTS dependency) for context relevant to the current request.

import { getAdapter } from "../db/driver.js";
import { searchMemories } from "./memorySearch.js";

let _tablesReady = false;

async function ensureTables() {
  if (_tablesReady) return;
  const db = await getAdapter();
  db.run(`CREATE TABLE IF NOT EXISTS nova_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_name TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'memory',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_nm_agent ON nova_memory(agent_name, created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_nm_session ON nova_memory(session_id)`);
  _tablesReady = true;
}

/**
 * After a task completes, ask the same model to distill one transferable
 * lesson from the interaction. Returns the skill text or null on failure.
 */
export async function learnFromTask(agent, instruction, result, sessionId) {
  try {
    await ensureTables();
    const db = await getAdapter();

    // Build a compact prompt asking the model to self-summarize.
    const learnPrompt = [
      "You just completed a task. Write ONE sentence describing a reusable technique,",
      "pitfall to avoid, or pattern you noticed. Be specific. No preamble.",
      "",
      `Task: ${String(instruction).slice(0, 300)}`,
      `Result: ${String(result).slice(0, 500)}`,
    ].join("\n");

    const { callModel } = await import("./orchestrator.js");
    const skill = await callModel(agent, [
      { role: "system", content: "You are a concise technical writer. Output exactly one sentence of actionable insight." },
      { role: "user", content: learnPrompt },
    ]);

    if (!skill || skill.length < 10) return null;

    db.run(
      `INSERT INTO nova_memory (session_id, agent_name, kind, content, created_at)
       VALUES (?, ?, 'skill', ?, ?)`,
      [sessionId || "", agent.name || "", skill.trim(), new Date().toISOString()]
    );
    return skill.trim();
  } catch {
    return null; // fail-open: learning is optional
  }
}

/**
 * Search past memories & learned skills for context relevant to the current
 * input. Ranked by relevance (FTS5/BM25 where the SQLite build supports it,
 * otherwise a term-count fallback), skills first.
 *
 * Returns up to `limit` short text snippets. Fail-open: recall is a bonus,
 * never a reason for a turn to fail.
 */
export async function recallMemory(agentName, userText, limit = 5) {
  try {
    await ensureTables();
    const db = await getAdapter();

    const { rows } = searchMemories(db, { agentName, text: userText, limit });
    const found = rows.map((r) => r.content).filter(Boolean);

    // Expand with graph links: memories the curator related to these matches.
    if (found.length) {
      try {
        const ids = db.all(
          `SELECT m.id AS id FROM nova_memory m
            WHERE m.agent_name LIKE ? AND m.content IN (${found.map(() => "?").join(",")})
            LIMIT ?`,
          [`%${agentName}%`, ...found, limit]
        );
        if (ids.length) {
          const idList = ids.map((r) => Number(r.id)).filter(Number.isFinite).join(",");
          if (idList) {
            const linked = db.all(
              `SELECT DISTINCT m.content FROM nova_memory_links l
                 JOIN nova_memory m ON m.id = CASE WHEN l.a_id IN (${idList}) THEN l.b_id ELSE l.a_id END
                WHERE (l.a_id IN (${idList}) OR l.b_id IN (${idList}))
                ORDER BY l.score DESC LIMIT 2`
            );
            for (const l of linked || []) {
              if (l?.content && !found.includes(l.content)) found.push(l.content);
            }
          }
        }
      } catch { /* links are optional */ }
    }

    return found;
  } catch {
    return [];
  }
}

/**
 * Inject learned skills + recalled memory into an agent's system prompt.
 * Called by orchestrator when building messages.
 */
export function injectLearnedContext(basePrompt, agentName, skills) {
  if (!skills || skills.length === 0) return basePrompt;
  const block = [
    "",
    "--- Learned techniques (from past tasks) ---",
    ...skills.slice(0, 5).map((s, i) => `${i + 1}. ${s}`),
    "--- Apply these when relevant ---",
  ].join("\n");
  return basePrompt + "\n" + block;
}
