// Daily safety backups of the SQLite database. Runs inside the app process
// (started from initializeApp alongside the other schedulers) so no external
// cron/systemd unit is required. Fail-open everywhere: a backup failure must
// never take the gateway down.

import fs from "node:fs";
import { getAdapter } from "./driver.js";
import { makeBackupDir, backupDbLite, pruneOldBackups } from "./backup.js";

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 45 * 1000;
const KEEP_DAILY_BACKUPS = 7;

let started = false;
let intervalHandle = null;
let initialTimeoutHandle = null;
let tickRunning = false;

function isNonServerRuntime() {
  if (typeof window !== "undefined") return true;
  const phase = process.env.NEXT_PHASE || "";
  if (phase === "phase-production-build" || phase === "phase-export" || phase === "phase-static") return true;
  if (process.env.NEXT_RUNTIME === "edge") return true;
  return false;
}

export async function runDailyBackup() {
  if (tickRunning) return { skipped: true, reason: "already-running" };
  tickRunning = true;
  let dir = null;
  try {
    const adapter = await getAdapter();
    if (!adapter || adapter.driver === "sql.js") {
      // sql.js keeps the DB in memory/WASM — file copy semantics differ and a
      // crash-consistent snapshot is not guaranteed; skip rather than corrupt.
      return { skipped: true, reason: "driver-not-supported" };
    }
    dir = makeBackupDir("daily");
    const dest = backupDbLite(adapter, dir, "data.sqlite");
    pruneOldBackups(KEEP_DAILY_BACKUPS);
    console.log(`[DbBackup] daily backup written: ${dest}`);
    return { ok: true, dest };
  } catch (e) {
    // Remove the partial artifact so a failed attempt never counts against
    // retention or looks like a usable backup.
    if (dir) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
    console.error("[DbBackup] daily backup failed:", e?.message || e);
    try {
      const { notifyEvent } = await import("@/lib/notify/events.js");
      await notifyEvent({
        event: "backup.failed",
        severity: "error",
        title: "Daily database backup FAILED",
        message: String(e?.message || e),
      });
    } catch {}
    return { ok: false, error: e?.message || String(e) };
  } finally {
    tickRunning = false;
  }
}

export function startDailyDbBackup({ intervalMs = INTERVAL_MS } = {}) {
  if (started || isNonServerRuntime()) return;
  started = true;

  initialTimeoutHandle = setTimeout(() => {
    runDailyBackup();
    intervalHandle = setInterval(() => runDailyBackup(), intervalMs);
  }, INITIAL_DELAY_MS);
  if (initialTimeoutHandle.unref) initialTimeoutHandle.unref();
  if (intervalHandle?.unref) intervalHandle.unref();

  const stop = () => {
    if (initialTimeoutHandle) clearTimeout(initialTimeoutHandle);
    if (intervalHandle) clearInterval(intervalHandle);
    started = false;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
