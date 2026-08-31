#!/usr/bin/env node
/**
 * Post-install: create dashboard connections for:
 * 1. All noAuth providers → active (work immediately: opencode, ollama-local, devin-cli, etc.)
 * 2. All hasFree providers needing auth → inactive (gemini-cli, ollama cloud, etc.)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || "/var/lib/novaroute";
const DB_PATH = join(DATA_DIR, "db", "data.sqlite");
function nowIso() { return new Date().toISOString(); }

async function openDb() {
  try { const { Database } = await import("better-sqlite3"); return { type: "better", db: new Database(DB_PATH) }; } catch {}
  try { const { DatabaseSync } = await import("node:sqlite"); return { type: "node", db: new DatabaseSync(DB_PATH) }; } catch {}
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs();
  const buffer = existsSync(DB_PATH) ? readFileSync(DB_PATH) : null;
  return { type: "sqljs", db: buffer ? new SQL.Database(buffer) : new SQL.Database(), SQL };
}

async function run() {
  if (!existsSync(DB_PATH)) { console.log("[setup] DB not found; skipping."); process.exit(0); }

  const registry = (await import("../open-sse/providers/registry/index.js")).default;

  // All noAuth providers → active, EXCEPT local/CLI: those need a real install
  // + service check first (dashboard "Install & Configure"), otherwise we ship
  // dead active connections that fail on every routing attempt.
  const isAutoInstallable = (r) => r.category !== "local" && r.category !== "cli";
  const noAuth = registry.filter((r) => r.noAuth === true && isAutoInstallable(r));
  // All hasFree providers needing auth → inactive
  const freeWithAuth = registry.filter((r) => r.hasFree === true && !r.noAuth && isAutoInstallable(r));

  const all = [
    ...noAuth.map((p) => ({ ...p, _auth: "none", _name: "Free", _active: 1 })),
    ...freeWithAuth.map((p) => ({ ...p, _auth: p.oauth ? "oauth" : "apikey", _name: "Free Tier", _active: 0 })),
  ];

  if (all.length === 0) { console.log("[setup] No providers."); process.exit(0); }
  console.log(`[setup] ${all.length} provider(s): ${noAuth.length} noAuth, ${freeWithAuth.length} free+auth`);

  const { type, db } = await openDb();
  const now = nowIso();
  let added = 0;

  function exists(sql, p) {
    if (type === "better") return db.prepare(sql).all(...p).length > 0;
    if (type === "node") return db.prepare(sql).all(...p).length > 0;
    return (db.exec(sql, p)[0]?.values || []).length > 0;
  }
  function ins(sql, p) {
    if (type === "better") db.prepare(sql).run(...p);
    else if (type === "node") db.prepare(sql).run(...p);
    else db.run(sql, p);
  }

  for (const p of all) {
    if (exists(`SELECT id FROM providerConnections WHERE provider = ?`, [p.id])) continue;
    ins(`INSERT INTO providerConnections(id,provider,authType,name,priority,isActive,data,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?)`,
      [randomUUID(), p.id, p._auth, p._name, 1, p._active, "{}", now, now]);
    added++;
    console.log(`  + ${p.id} [${p._auth}] ${p._active ? "(active)" : "(needs setup)"}`);
  }

  if (type === "sqljs") writeFileSync(DB_PATH, Buffer.from(db.export()));
  else db.close();
  console.log(`[setup] Done. ${added} new connection(s).`);
}

run().catch((e) => { console.error("[setup]", e.message); process.exit(1); });
