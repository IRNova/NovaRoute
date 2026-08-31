// Nova Bot — Skills & Scheduler engine.
// Manages the skills library (pre-loaded from Hermes patterns) and the
// natural-language task scheduler.

import { getAdapter } from "../db/driver.js";
import { notifyAdmin } from "./telegramApi.js";

let _tablesReady = false;

async function ensureTables() {
  if (_tablesReady) return;
  const db = await getAdapter();
  db.run(`CREATE TABLE IF NOT EXISTS nova_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL DEFAULT '',
    skill_name TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'hermes',
    usage_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS nova_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    prompt TEXT NOT NULL,
    agent_name TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run TEXT,
    created_at TEXT NOT NULL
  )`);
  _tablesReady = true;
}

/* ── Skills ─────────────────────────────────────────────────────────── */

export async function getAllSkills(agentName = "") {
  await ensureTables();
  const db = await getAdapter();
  if (agentName) {
    return db.all(
      `SELECT * FROM nova_skills WHERE agent_name = ? OR agent_name = '' ORDER BY usage_count DESC, created_at DESC`,
      [agentName]
    );
  }
  return db.all(`SELECT * FROM nova_skills ORDER BY usage_count DESC, created_at DESC`);
}

export async function addSkill(agentName, skillName, content, source = "manual") {
  await ensureTables();
  const db = await getAdapter();
  const r = db.run(
    `INSERT INTO nova_skills (agent_name, skill_name, content, source, created_at) VALUES (?, ?, ?, ?, ?)`,
    [agentName || "", skillName, content, source, new Date().toISOString()]
  );
  return { id: r.changes, skillName };
}

export async function deleteSkill(id) {
  await ensureTables();
  const db = await getAdapter();
  db.run(`DELETE FROM nova_skills WHERE id = ?`, [id]);
}

export async function bumpSkillUsage(id) {
  await ensureTables();
  const db = await getAdapter();
  db.run(`UPDATE nova_skills SET usage_count = usage_count + 1 WHERE id = ?`, [id]);
}

/**
 * Returns up to `limit` skill contents relevant to the given text.
 * Simple keyword overlap scoring — no embeddings needed.
 */
export async function matchSkills(userText, limit = 4) {
  await ensureTables();
  const db = await getAdapter();
  const all = db.all(`SELECT skill_name, content FROM nova_skills ORDER BY usage_count DESC LIMIT 50`);
  if (!all.length) return [];

  const words = String(userText || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return all.slice(0, limit).map((s) => s.content);

  const scored = all.map((s) => {
    const lower = (s.skill_name + " " + s.content).toLowerCase();
    const hits = words.filter((w) => lower.includes(w)).length;
    return { ...s, score: hits };
  }).filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => `[${s.skill_name}] ${s.content}`);
}

/**
 * Seed the skills table with proven coding techniques from Hermes Agent.
 * Only inserts if table is empty (one-time boot).
 */
export async function seedHermesSkills() {
  await ensureTables();
  const db = await getAdapter();
  const count = db.get(`SELECT COUNT(*) as c FROM nova_skills`);
  if (count.c > 0) return;

  const SEEDS = [
    ["", "systematic-debugging", "Before fixing any bug: 1) Reproduce it reliably. 2) Read the error message carefully. 3) Form a hypothesis about root cause. 4) Test hypothesis with minimal change. 5) Fix and verify. Never guess-and-check."],
    ["", "test-driven-development", "Write failing test first, then minimal code to pass it, then refactor. Cycle: RED → GREEN → REFACTOR. Tests document intent better than comments."],
    ["", "code-review-security", "Before committing: scan for hardcoded secrets, SQL injection, XSS, path traversal, race conditions. Check input validation on every public endpoint."],
    ["", "simplify-code", "After features work: remove dead code, extract repeated logic into functions, shorten names only if still clear, reduce nesting depth. Each cleanup must not change behavior."],
    ["", "plan-before-code", "Write a short markdown plan before implementing anything non-trivial: goal, approach, files touched, risks. Review plan before writing code."],
    ["", "spike-first", "For uncertain technical decisions: write throwaway code to test the idea before building production quality. Delete spike after learning."],
    ["", "error-messages", "Error messages must say: what went wrong, why, and what to do next. Include the actual value that caused the error when safe."],
    ["", "api-design", "Consistent naming (REST verbs), validate inputs at boundary, return structured errors with status codes, version your API."],
    ["", "git-workflow", "Small focused commits with imperative messages. Branch per feature. Rebase before PR. Never force-push shared branches."],
    // ── Hermes wave 2: github / devops ──
    ["", "github-pr-workflow", "PR lifecycle: create branch → small commits → push → open PR with clear description → watch CI → fix failures → merge. Always check CI status before declaring done."],
    ["", "github-issues", "Good issue: reproducible steps, expected vs actual behavior, environment info. Triage with labels; link PRs closing them ('Fixes #123')."],
    ["", "github-code-review", "Review order: 1) Does it solve the stated problem? 2) Tests cover edge cases? 3) Security implications? 4) Naming/readability? Comment on specifics, suggest don't command."],
    ["", "codebase-inspection", "Before changing unfamiliar code: count files/languages, find entry points, trace one request end-to-end, note test coverage. Never edit what you haven't read."],
    ["", "sdlc-review", "End-to-end review: requirements met? design sound? implementation correct? tests meaningful? docs updated? deploy safe? Each gate gets a verdict."],
    // ── research ──
    ["", "arxiv-research", "Search papers by keyword/author/category. Read abstract first; only deep-read if relevant. Track citations to find foundational work."],
    ["", "grounded-citations", "Every factual claim in reports needs a source link or explicit 'unverified'. Prefer primary sources over aggregators. Quote exactly."],
    ["", "competitor-monitoring", "Track named companies: product launches, pricing changes, hiring spikes, funding. Cite each finding with date+URL; flag rumors as unconfirmed."],
    // ── productivity ──
    ["", "docx-handling", "Word files: extract text via unzip of document.xml or python-docx equivalent. Preserve structure when editing templates. Validate output opens cleanly."],
    ["", "pdf-extraction", "PDFs: text layer first (pdftotext/pymupdf); scanned pages need OCR. Note page numbers for citations. Tables often need special handling."],
    ["", "xlsx-spreadsheets", "Excel: prefer CSV roundtrip for simple data; use libraries for formulas/styling. Never lose user formatting on targeted edits."],
    ["", "meeting-action-items", "From meeting notes extract: decision, owner, deadline per item. Output a table. Flag items without owners. Cite the exact note line for each."],
    ["", "weekly-review", "Weekly reset ritual: list commitments made vs done, identify stalled items and why, pick top 3 for next week. Keep it under 15 minutes."],
    ["", "document-to-actions", "Contracts/documents: extract obligations (who must do what by when), deadlines, penalties, termination clauses. Quote exact text with location."],
    // ── creative ──
    ["", "diagram-design", "Architecture diagrams: boxes=components, arrows=data flow direction, label every arrow with protocol/format. Dark theme, consistent spacing, SVG preferred."],
    ["", "humanizer-writing", "Strip AI-isms: remove 'delve', 'tapestry', 'moreover', em-dash chains, rule-of-three padding. Vary sentence length. Use concrete verbs over abstractions."],
    ["", "sketch-mockups", "Quick UI mockups: produce 2-3 HTML variants differing in layout hierarchy, not just colors. Single-file, inline CSS, real placeholder copy not lorem ipsum."],
  ];

  const now = new Date().toISOString();
  for (const [agent, name, content] of SEEDS) {
    db.run(
      `INSERT INTO nova_skills (agent_name, skill_name, content, source, created_at) VALUES (?, ?, ?, 'hermes', ?)`,
      [agent, name, content, now]
    );
  }
}

/* ── Scheduler ─────────────────────────────────────────────────────── */

export async function getSchedules() {
  await ensureTables();
  const db = await getAdapter();
  return db.all(`SELECT * FROM nova_schedules ORDER BY created_at DESC`);
}

export async function addSchedule(name, schedule, prompt, agentName) {
  await ensureTables();
  const db = await getAdapter();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO nova_schedules (name, schedule, prompt, agent_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    [name, schedule, prompt, agentName || "", now]
  );
}

export async function toggleSchedule(id, enabled) {
  await ensureTables();
  const db = await getAdapter();
  db.run(`UPDATE nova_schedules SET enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
}

export async function deleteSchedule(id) {
  await ensureTables();
  const db = await getAdapter();
  db.run(`DELETE FROM nova_schedules WHERE id = ?`, [id]);
}

/**
 * Check for due schedules and return those that should run now.
 * Called periodically by the app's background tick.
 */
export async function getDueSchedules() {
  await ensureTables();
  const db = await getAdapter();
  const now = new Date().toISOString();
  const all = db.all(`SELECT * FROM nova_schedules WHERE enabled = 1`);

  return all.filter((s) => {
    if (!s.last_run) return true;
    const elapsed = Date.now() - new Date(s.last_run).getTime();
    const sched = s.schedule.toLowerCase();

    if (sched.includes("hour")) {
      const hours = parseInt(sched) || 1;
      return elapsed >= hours * 3600000;
    }
    if (sched.includes("min")) {
      const mins = parseInt(sched) || 30;
      return elapsed >= mins * 60000;
    }
    // default: daily
    return elapsed >= 86400000;
  });
}

export async function markScheduleRun(id) {
  await ensureTables();
  const db = await getAdapter();
  db.run(`UPDATE nova_schedules SET last_run = ? WHERE id = ?`, [new Date().toISOString(), id]);
}

/**
 * Parse natural-language schedule phrases into a canonical schedule string.
 * Supports: "every 30 minutes/mins", "هر N دقیقه", "every 6 hours/hourly",
 * "هر N ساعت", "daily at HH:MM", "روزانه ساعت X", "weekly/هفتگی".
 * Returns null when nothing recognizable.
 */
export function parseScheduleNL(text) {
  const t = String(text || "").toLowerCase();

  let m = t.match(/(?:every|هر)\s*(\d{1,3})?\s*(minutes?|mins?|دقیقه)/);
  if (m) return `every ${Math.min(parseInt(m[1] || "30", 10), 720)}m`;
  if (/\bhourly\b|هر ساعت/.test(t)) return "every 1h";

  m = t.match(/(?:every|هر)\s*(\d{1,2})?\s*(hours?|ساعت)/);
  if (m) return `every ${Math.min(parseInt(m[1] || "1", 10), 168)}h`;

  m = t.match(/(?:daily|روزانه|هر روز|روزی یکبار)(?:.*?(?:at|ساعت)\s*(\d{1,2})[:.؟]?(\d{2}))?/);
  if (m) {
    const hh = Math.min(parseInt(m[1] || "9", 10), 23);
    const mm = Math.min(parseInt(m[2] || "0", 10) || 0, 59);
    return `daily ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  if (/\bweekly\b|هفتگی|هر هفته/.test(t)) return "weekly";
  return null;
}

/**
 * Cron tick — run all due schedules through the orchestrator in a dedicated
 * "[cron]" session per schedule so results are visible on the dashboard.
 * Called from a background interval started by the orchestrator.
 */
export async function runDueSchedules(runTurn) {
  const due = await getDueSchedules();
  for (const s of due) {
    let okRun = true;
    try {
      await runTurn(s);
    } catch (e) {
      okRun = false;
      const fails = ((await _kvGet("schedFails", {})) || {});
      fails[s.id] = (fails[s.id] || 0) + 1;
      await _kvSet("schedFails", fails);
      if (fails[s.id] === 2) notifyAdmin(`⚠️ زمان‌بند «${s.name}» دوبار پشت‌هم شکست خورد.`).catch(() => {});
      if (fails[s.id] >= 3) {
        await toggleSchedule(s.id, false);
        notifyAdmin(`⛔️ زمان‌بند «${s.name}» بعد از ۳ خطا خاموش شد.`).catch(() => {});
      }
    }
    if (okRun) {
      try {
        const fails = ((await _kvGet("schedFails", {})) || {});
        if (fails[s.id]) { delete fails[s.id]; await _kvSet("schedFails", fails); }
        await markScheduleRun(s.id);
      } catch { /* ignore */ }
    }
  }
}

// ── Event-triggered blueprints (Hermes blueprint_catalog style) ──
// Rows in nova_schedules whose schedule starts with 'trigger:keyword:' fire
// when a user message contains the keyword (cooldown 60s per blueprint).

async function _kvGet(key, dflt) {
  try { const { makeKv } = await import("../db/helpers/kvStore.js"); return (await makeKv("novaCron").get(key, dflt)) ?? dflt; }
  catch { return dflt; }
}
async function _kvSet(key, val) {
  try { const { makeKv } = await import("../db/helpers/kvStore.js"); await makeKv("novaCron").set(key, val); } catch {}
}

/** Parse "trigger:keyword:word[,word2]" schedule field. Returns null if not a trigger. */
export function parseTrigger(scheduleField) {
  const t = String(scheduleField || "");
  if (!t.startsWith("trigger:keyword:")) return null;
  const words = t.slice("trigger:keyword:".length).split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  return words.length ? words : null;
}

/** Evaluate all keyword blueprints against a user message; returns due rows. */
export async function evaluateTriggerBlueprints(userText) {
  await ensureTables();
  const db = await getAdapter();
  const all = db.all(`SELECT * FROM nova_schedules WHERE enabled = 1`);
  const lower = String(userText || "").toLowerCase();
  const now = Date.now();
  const lastMap = ((await _kvGet("triggerLast", {})) || {});
  const due = [];
  for (const row of all) {
    const words = parseTrigger(row.schedule);
    if (!words) continue;
    if (!words.some((w) => lower.includes(w))) continue;
    if (lastMap[row.id] && now - lastMap[row.id] < 60_000) continue;
    lastMap[row.id] = now;
    due.push(row);
  }
  if (due.length) await _kvSet("triggerLast", lastMap);
  return due;
}

/** Add a keyword-trigger blueprint. */
export async function addTriggerBlueprint(name, keywords, prompt, agentName) {
  await ensureTables();
  const db = await getAdapter();
  db.run(
    `INSERT INTO nova_schedules (name, schedule, prompt, agent_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    [String(name).slice(0, 80), `trigger:keyword:${keywords.map((k) => k.toLowerCase()).join(",")}`, String(prompt), agentName || "", new Date().toISOString()],
  );
}
