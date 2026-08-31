// NovaRoute structured logger — zero-dependency.
// - Levels: debug/info/warn/error/fatal
// - Mirrors to console (journald picks it up) AND appends JSON-lines to
//   $DATA_DIR/logs/app-YYYY-MM-DD.log with automatic rotation (10MB × 3 + 14d).
// - Keeps an in-memory ring buffer (last N entries) exposed via /logs API.
// - Child loggers carry a component tag and optional traceId.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

function resolveLogsDir() {
  const dataDir = process.env.DATA_DIR || path.join(os.homedir(), ".novaroute");
  const dir = path.join(dataDir, "logs");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

const LOGS_DIR = resolveLogsDir();
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROTATED = 3;
const RETENTION_DAYS = 14;
const RING_SIZE = 500;

const state = {
  ring: [],
  minLevel: LEVELS[process.env.NOVA_LOG_LEVEL || "debug"] || LEVELS.debug,
  traceId: null,
};

function rotateIfNeeded(file) {
  try {
    const st = fs.statSync(file);
    if (st.size < MAX_FILE_BYTES) return;
    for (let i = MAX_ROTATED - 1; i >= 1; i--) {
      const from = `${file}.${i}`;
      const to = `${file}.${i + 1}`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    fs.renameSync(file, `${file}.1`);
  } catch {}
}

function pruneOldFiles() {
  try {
    const cutoff = Date.now() - RETENTION_DAYS * 86400_000;
    for (const f of fs.readdirSync(LOGS_DIR)) {
      const m = f.match(/app-(\d{4}-\d{2}-\d{2})/) || f.match(/fatal-(\d{4}-\w{3}-\d{2})/);
      if (!m) continue;
      if (new Date(m[1]).getTime() < cutoff) fs.rmSync(path.join(LOGS_DIR, f), { force: true });
    }
  } catch {}
}

function writeFileLine(line) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(LOGS_DIR, `app-${day}.log`);
    rotateIfNeeded(file);
    fs.appendFileSync(file, line + "\n");
  } catch {}
}

function fmt(v) {
  if (v instanceof Error) return v.stack || `${v.name}: ${v.message}`;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function emit(level, comp, msg, ctx) {
  if (LEVELS[level] < state.minLevel) return;
  const entry = {
    t: new Date().toISOString(),
    lvl: level,
    comp,
    msg: typeof msg === "string" ? msg : fmt(msg),
    ...(ctx && Object.keys(ctx).length ? { ctx } : {}),
    ...(state.traceId ? { trace: state.traceId } : {}),
  };
  const json = JSON.stringify(entry);

  // console mirror — stderr for warn+, stdout otherwise (journald friendly)
  const line = `[${entry.t}] ${level.toUpperCase()} ${comp ? `<${comp}>` : ""} ${entry.msg}${entry.ctx ? " " + JSON.stringify(entry.ctx) : ""}${entry.trace ? ` trace=${entry.trace}` : ""}`;
  if (LEVELS[level] >= LEVELS.warn) process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");

  writeFileLine(json);

  // fatal mirror to a dedicated always-on file (survives even misconfig)
  if (level === "fatal") {
    try {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const f = path.join(LOGS_DIR, `fatal-${day}.log`);
      fs.appendFileSync(f, line + "\n");
    } catch {}
  }

  state.ring.push(entry);
  if (state.ring.length > RING_SIZE) state.ring.splice(0, state.ring.length - RING_SIZE);
}

function makeLogger(comp = "") {
  const out = {};
  for (const lvl of Object.keys(LEVELS)) {
    out[lvl] = (msg, ctx) => emit(lvl, comp, msg, ctx);
  }
  out.child = (sub) => makeLogger(comp ? `${comp}:${sub}` : sub);
  out.withTrace = (id) => {
    state.traceId = id || null;
    return out;
  };
  return out;
}

export const logger = {
  ...makeLogger(""),
  logsDir: LOGS_DIR,
  ring: () => state.ring.slice(),
  setLevel(name) {
    if (LEVELS[name]) state.minLevel = LEVELS[name];
  },
  newTrace() {
    state.traceId = randomUUID();
    return state.traceId;
  },
  clearTrace() {
    state.traceId = null;
  },
};

// one-time housekeeping sweep at boot
pruneOldFiles();
setInterval(pruneOldFiles, 6 * 3600_000).unref?.();

/** Install process-wide safety nets exactly once (call early in boot). */
export function installGlobalHandlers() {
  const g = globalThis;
  if (g.__novaLogHandlers) return;
  g.__novaLogHandlers = true;

  process.on("uncaughtException", (e) => {
    emit("fatal", "process", "uncaughtException", { err: fmt(e) });
  });
  process.on("unhandledRejection", (e) => {
    emit("fatal", "process", "unhandledRejection", { err: fmt(e) });
  });
  ["SIGTERM", "SIGINT"].forEach((sig) => {
    process.on(sig, () => {
      emit("info", "process", `received ${sig}, exiting`);
      process.exit(0);
    });
  });
}
