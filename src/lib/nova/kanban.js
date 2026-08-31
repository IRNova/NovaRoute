// Nova Bot — Kanban board for multi-step agent projects (Hermes kanban style).
// SQLite-backed: boards → cards with column flow backlog/todo/doing/done.

import { getAdapter } from "../db/driver.js";

let _ready = false;
async function ensureTables() {
  if (_ready) return;
  const db = await getAdapter();
  db.run(`CREATE TABLE IF NOT EXISTS nova_kanban_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board TEXT NOT NULL DEFAULT 'main',
    session_id TEXT,
    title TEXT NOT NULL,
    notes TEXT,
    col TEXT NOT NULL DEFAULT 'todo',
    position INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  _ready = true;
}

const COLS = ["backlog", "todo", "doing", "done"];

export async function addCard(board, title, notes, sessionId) {
  await ensureTables();
  const db = await getAdapter();
  const now = new Date().toISOString();
  const pos = (db.get(`SELECT COALESCE(MAX(position),0)+1 as p FROM nova_kanban_cards WHERE board=? AND col='todo'`, [board])?.p) || 1;
  const r = db.run(
    `INSERT INTO nova_kanban_cards (board, session_id, title, notes, col, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'todo', ?, ?, ?)`,
    [board || "main", sessionId || null, String(title).slice(0, 300), notes ? String(notes).slice(0, 2000) : null, pos, now, now]
  );
  return { id: r.meta?.lastInsertRowid ?? r.lastInsertRowid ?? null };
}

export async function listCards(board, col) {
  await ensureTables();
  const db = await getAdapter();
  let sql = `SELECT id, title, notes, col, position, updated_at FROM nova_kanban_cards WHERE board = ?`;
  const args = [board || "main"];
  if (col && COLS.includes(col)) { sql += ` AND col = ?`; args.push(col); }
  sql += ` ORDER BY col, position ASC`;
  return db.all(sql, args);
}

export async function moveCard(id, toCol, position) {
  await ensureTables();
  if (!COLS.includes(toCol)) return false;
  const db = await getAdapter();
  db.run(
    `UPDATE nova_kanban_cards SET col=?, position=?, updated_at=? WHERE id=?`,
    [toCol, Number.isFinite(position) ? position : Date.now() % 100000, new Date().toISOString(), id]
  );
  return true;
}

export async function updateCardNotes(id, notes) {
  await ensureTables();
  const db = await getAdapter();
  db.run(`UPDATE nova_kanban_cards SET notes=?, updated_at=? WHERE id=?`,
    [String(notes).slice(0, 2000), new Date().toISOString(), id]);
  return true;
}

export async function deleteCard(id) {
  await ensureTables();
  const db = await getAdapter();
  db.run(`DELETE FROM nova_kanban_cards WHERE id=?`, [id]);
  return true;
}

function renderBoard(cards) {
  if (!cards.length) return "Board is empty.";
  const byCol = Object.fromEntries(COLS.map((c) => [c, []]));
  for (const c of cards) (byCol[c.col] || byCol.todo).push(c);
  return COLS.map((col) => {
    const items = byCol[col];
    const head = `== ${col.toUpperCase()} (${items.length}) ==`;
    if (!items.length) return head;
    return head + "\n" + items.map((c) =>
      `#${c.id} ${c.title}${c.notes ? `\n   ↳ ${c.notes.slice(0, 160)}` : ""}`
    ).join("\n");
  }).join("\n\n");
}

export { renderBoard };
