// Shared entry point for the self-update worker.
//
// Three separate update paths used to exist (an inline `git pull` in
// /api/setup/update, a release-tarball worker in /api/github-update/apply, and
// the npm-package updater for the CLI build). The first two both drive a
// server install, so they now share this launcher and one worker, and report
// through one status file.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveAppRoot } from "./appRoot.js";

export const STATUS_DIR = () => path.join(resolveAppRoot(), ".update-status");
export const STATUS_FILE = () => path.join(STATUS_DIR(), "status.json");

const WORKER = () => path.join(resolveAppRoot(), "src", "lib", "updater", "githubUpdateWorker.js");

// An update older than this is treated as abandoned rather than in-flight, so
// a worker killed mid-run cannot wedge the button forever.
const STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * The environment the update runs in.
 *
 * NOT process.env. .next/standalone/server.js assigns
 * `process.env.__NEXT_PRIVATE_STANDALONE_CONFIG` at runtime, so the running
 * server carries it even though it never appears in the process's initial
 * environment. Inheriting it makes `next build` fail with
 * "TypeError: generate is not a function", which is what killed the update
 * after everything else about it had been fixed. Anything Next sets for itself
 * at runtime is stripped before the build sees it.
 */
export function buildEnv(env = process.env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("__NEXT_")) continue;
    out[key] = value;
  }
  return out;
}

export function readUpdateStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE(), "utf8"));
  } catch {
    return null;
  }
}

export function isUpdateInFlight() {
  const status = readUpdateStatus();
  if (!status || status.done) return false;
  return Date.now() - new Date(status.updatedAt || 0).getTime() < STALE_AFTER_MS;
}

/** Is this deployment one the worker can actually restart? */
export function canSelfUpdate() {
  if (process.platform !== "linux") {
    return { ok: false, error: "Auto-update is only supported on the Linux server deployment (systemd)." };
  }
  if (!fs.existsSync("/usr/bin/systemctl") && !fs.existsSync("/bin/systemctl")) {
    return { ok: false, error: "Auto-update requires systemd; this host has no systemctl." };
  }
  if (!fs.existsSync(WORKER())) {
    return { ok: false, error: "Updater worker not found in this installation" };
  }
  return { ok: true };
}

/**
 * Spawn the detached update worker.
 * @param {{ mode: "git"|"tag", ref: string }} job
 */
export function isValidRef(mode, ref) {
  const value = String(ref || "");
  if (mode === "tag") return /^[A-Za-z0-9._-]+$/.test(value);
  if (mode === "git") return /^[A-Za-z0-9._/-]+$/.test(value);
  return false;
}

export function startUpdate({ mode, ref }) {
  // The ref is interpolated into a shell command by the worker, so it is
  // validated before anything else and on every platform.
  if (mode !== "git" && mode !== "tag") {
    return { ok: false, status: 400, error: `Unknown update mode: ${mode}` };
  }
  if (!isValidRef(mode, ref)) {
    return {
      ok: false,
      status: 400,
      error: mode === "tag" ? "A valid release tag is required" : "A valid branch name is required",
    };
  }

  const supported = canSelfUpdate();
  if (!supported.ok) return { ok: false, status: 400, error: supported.error };

  if (isUpdateInFlight()) {
    return { ok: false, status: 409, error: "An update is already in progress" };
  }

  fs.mkdirSync(STATUS_DIR(), { recursive: true });
  fs.writeFileSync(
    STATUS_FILE(),
    JSON.stringify(
      { mode, ref, tag: mode === "tag" ? ref : null, step: "starting", pct: 1, done: false, error: null, updatedAt: new Date().toISOString(), log: [] },
      null,
      2
    )
  );

  const child = spawn(process.execPath, [WORKER(), `--mode=${mode}`, `--ref=${ref}`], {
    detached: true,
    stdio: "ignore",
    cwd: resolveAppRoot(),
    env: buildEnv(),
  });
  child.unref();

  return { ok: true, status: 202, mode, ref };
}
