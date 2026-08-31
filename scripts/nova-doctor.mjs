#!/usr/bin/env node
// NovaRoute doctor — pre-flight & post-deploy health check.
//   node scripts/nova-doctor.mjs [--db] [--logs]
// Checks:
//  1. Syntax of every server-side JS file (lib + nova API routes)
//  2. Expected SQLite tables exist (catches snake_case/camelCase drift)
//  3. Native driver status (better-sqlite3 loadable? fallback?)
//  4. Env essentials (PORT, DATA_DIR, JWT_SECRET presence)
//  5. Recent fatal/error log lines

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const arg = (k) => process.argv.includes(k);
let failures = 0;

const ok = (m) => console.log("  ✅", m);
const bad = (m) => { console.log("  ❌", m); failures++; };
const info = (m) => console.log("  ℹ️ ", m);
const head = (m) => console.log("\n■ " + m);

/* ── 1. syntax sweep ─────────────────────────────────────────────── */
head("1) Server JS syntax sweep");
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.includes("node_modules")) walk(p, out);
    else if (/\.js$/.test(e.name)) out.push(p);
  }
  return out;
}
const targets = [
  ...walk(path.join(ROOT, "src/lib/nova")),
  ...walk(path.join(ROOT, "src/app/api/dashboard/nova")),
  ...walk(path.join(ROOT, "open-sse/providers/registry")),
].filter((f) => !f.includes("node_modules"));

let checked = 0, jsxSkipped = 0, syntaxBad = [];
for (const f of targets) {
  const src = fs.readFileSync(f, "utf8");
  // crude JSX detector — skip UI files
  if (/return\s*\(\s*<|<\/[A-Za-z]|<[A-Z][A-Za-z]+[\s/>]/.test(src)) { jsxSkipped++; continue; }
  const tmp = f + ".doctor.mjs";
  fs.writeFileSync(tmp, src);
  try {
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
    checked++;
  } catch (e) {
    syntaxBad.push(`${path.relative(ROOT, f)} → ${String(e.stderr).split("\n")[1] || "syntax error"}`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
if (syntaxBad.length) syntaxBad.forEach((b) => bad(b));
else ok(`syntax clean: ${checked} files (${jsxSkipped} JSX skipped)`);

/* ── 2. DB tables ────────────────────────────────────────────────── */
if (arg("--db")) {
  head("2) SQLite tables");
  try {
    const { DatabaseSync } = await import("node:sqlite").then((m) => m).catch(() => ({}) );
    const dataDir = process.env.DATA_DIR || path.join(os.homedir(), ".novaroute");
    const dbFile = path.join(dataDir, "db", "data.sqlite");
    if (!fs.existsSync(dbFile)) {
      bad(`db file not found: ${dbFile}`);
    } else if (!DatabaseSync) {
      info("node:sqlite unavailable in this runtime — skipping table audit");
    } else {
      const db = new DatabaseSync(dbFile, { readOnly: true });
      const have = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
      const EXPECTED = [
        "apiKeys","providerConnections","providerNodes","combos","settings","kv",
        "usageHistory","usageDaily","routingStats","routingTimeline","semanticCache",
        "requestDetails","redeemTokens","keyGroups","keyGroupMembers","keyGroupPermissions","proxyPools",
        "novaAgents","novaSessions","novaMessages","novaTasks",
        "nova_memory","nova_skills","nova_schedules","nova_todos","nova_checkpoints","nova_kanban_cards",
      ];
      const missing = EXPECTED.filter((t) => !have.has(t));
      if (missing.length) missing.forEach((t) => bad(`missing table: ${t}`));
      else ok(`all ${EXPECTED.length} expected tables present`);
      db.close();
    }
  } catch (e) {
    info("table audit skipped:", e.message.slice(0, 100));
  }
}

/* ── 3. native drivers ───────────────────────────────────────────── */
head("3) DB drivers");
try {
  const mod = await import("../src/lib/db/adapters/betterSqliteAdapter.js").then((m) => m.createBetterSqliteAdapter("/tmp/nv-doctor.db")).catch((e) => ({ __fail: e }));
  if (mod && !mod.__fail) ok("better-sqlite3 loads & opens");
  else bad(`better-sqlite3 unusable: ${String(mod?.__fail?.message || mod).slice(0, 120)} → runtime falls back to node:sqlite`);
  fs.rmSync("/tmp/nv-doctor.db", { force: true });
} catch (e) { info("driver probe error:", e.message.slice(0, 100)); }

/* ── 4. env essentials ───────────────────────────────────────────── */
head("4) Environment");
for (const k of ["PORT", "DATA_DIR"]) {
  if (process.env[k]) ok(`${k}=${process.env[k]}`);
  else info(`${k} not set (defaults apply)`);
}
if (!process.env.JWT_SECRET) bad("JWT_SECRET not set — sessions use insecure default!");
else ok("JWT_SECRET set");

/* ── 5. recent fatals ────────────────────────────────────────────── */
head("5) Recent fatal/error log tail");
try {
  const logsDir = path.join(process.env.DATA_DIR || path.join(os.homedir(), ".novaroute"), "logs");
  const files = fs.existsSync(logsDir) ? fs.readdirSync(logsDir).sort().slice(-2) : [];
  let lines = [];
  for (const f of files) {
    const arr = fs.readFileSync(path.join(logsDir, f), "utf8").split("\n").filter(Boolean);
    lines.push(...arr.filter((l) => /"lvl":"(error|fatal)"/.test(l)));
  }
  const last = lines.slice(-10);
  if (!last.length) ok("no recent errors 🎉");
  else last.forEach((l) => console.log("   ", l.slice(0, 220)));
} catch (e) { info("log tail skipped:", e.message.slice(0, 80)); }

console.log(failures === 0 ? "\n🟢 DOCTOR: ALL CHECKS PASSED" : `\n🔴 DOCTOR: ${failures} issue(s)`);
process.exit(failures === 0 ? 0 : 1);
