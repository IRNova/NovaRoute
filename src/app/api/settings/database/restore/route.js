import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { BACKUPS_DIR } from "@/lib/db/paths.js";
import { getAdapter } from "@/lib/db/driver.js";
import { makeBackupDir, backupDbLite } from "@/lib/db/backup.js";
import { verifyDashboardAuthToken } from "@/lib/auth/dashboardSession";

// Table names come out of the attached backup file and are interpolated into
// SQL, so they are held to plain identifiers. The global guard already gates
// this route; this is the second lock on the same door.
const SAFE_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

function deny() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Tables whose content is intentionally excluded from daily backups — if a
// restore source lacks them, current live data is left untouched.
const SKIP_IF_MISSING = new Set(["requestDetails"]);

// POST /api/settings/database/restore { name: "daily-..." }
//
// Restores by copying rows FROM the attached backup INTO the live database
// inside one transaction (no file juggling under an open driver handle).
// Safety sequence:
//   1. validated name (no traversal)
//   2. fresh "pre-restore" snapshot of the CURRENT database first
export async function POST(request) {
  const token = request.cookies.get("auth_token")?.value;
  // Presence of a cookie is not authentication — verify the signature.
  if (!token || !(await verifyDashboardAuthToken(token))) return deny();
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || "");
    if (!/^daily-[A-Za-z0-9._-]+$/.test(name)) {
      return NextResponse.json({ error: "Invalid backup name" }, { status: 400 });
    }
    const dir = path.join(BACKUPS_DIR, name);
    const resolvedDir = path.resolve(dir);
    if (!resolvedDir.startsWith(path.resolve(BACKUPS_DIR) + path.sep)) {
      return NextResponse.json({ error: "Invalid backup name" }, { status: 400 });
    }
    const srcFile = path.join(resolvedDir, "data.sqlite");
    if (!fs.existsSync(srcFile)) {
      return NextResponse.json({ error: "Backup file not found" }, { status: 404 });
    }

    const db = await getAdapter();

    // 1. Snapshot the current state so the operation itself is reversible.
    try {
      const snapDir = makeBackupDir("pre-restore");
      backupDbLite(db, snapDir, "data.sqlite");
    } catch (e) {
      console.warn("[Restore] pre-restore snapshot failed:", e?.message);
    }

    // 2. Copy backup → main, table by table.
    const escaped = srcFile.replace(/'/g, "''");
    db.exec(`ATTACH DATABASE '${escaped}' AS res`);
    const restored = [];
    let skippedVirtual = 0;
    try {
      const resTables = db
        .all(`SELECT name, sql FROM res.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
        .filter((t) => !SKIP_IF_MISSING.has(t.name));

      const virtualNames = new Set(
        resTables.filter((t) => /^CREATE VIRTUAL TABLE/i.test(t.sql || "")).map((t) => t.name)
      );
      const shadowPrefixes = [...virtualNames].map((n) => `${n}_`);

      // Recreate missing virtual tables in main (best-effort; indexes rebuild).
      for (const v of resTables.filter((t) => virtualNames.has(t.name))) {
        try {
          db.exec(String(v.sql).replace(/^CREATE VIRTUAL TABLE\s+/i, "CREATE VIRTUAL TABLE main."));
        } catch {}
        skippedVirtual += 1;
      }

      const copyable = resTables.filter(
        (t) =>
          SAFE_TABLE_NAME.test(t.name) &&
          !virtualNames.has(t.name) &&
          !shadowPrefixes.some((p) => t.name.startsWith(p))
      );

      db.transaction(() => {
        for (const t of copyable) {
          const exists = db.get(
            `SELECT name FROM main.sqlite_master WHERE type='table' AND name=?`,
            [t.name]
          );
          if (exists) {
            db.run(`DELETE FROM main."${t.name}"`);
            db.run(`INSERT INTO main."${t.name}" SELECT * FROM res."${t.name}"`);
          } else {
            const createSql = String(t.sql).replace(/CREATE TABLE\s+/i, "CREATE TABLE main.");
            db.exec(createSql);
            db.exec(`INSERT INTO main."${t.name}" SELECT * FROM res."${t.name}"`);
          }
          restored.push(t.name);
        }
      });
    } finally {
      try { db.exec("DETACH DATABASE res"); } catch {}
    }

    console.log(`[Restore] restored ${restored.length} tables from ${name}`);
    return NextResponse.json({
      success: true,
      restoredTables: restored.length,
      restartRecommended: true,
    });
  } catch (error) {
    console.error("[Restore] failed:", error?.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
