#!/usr/bin/env node
/* __novaFatalHooks */
const fs = require("fs");
/* __logDirResolved */
const __path = require("path");
const __os = require("os");
const __dataDir = process.env.DATA_DIR || __path.join(__os.homedir(), ".novaroute");
const __logsDir = __path.join(__dataDir, "logs");
try { fs.mkdirSync(__logsDir, { recursive: true }); } catch {}
process.on('uncaughtException', (e) => console.error('[FATAL-uncaught]', e?.stack || e));
process.on('unhandledRejection', (e) => console.error('[FATAL-rejection]', (e instanceof Error ? e.stack : e) || e));
const origConsoleError = console.error.bind(console);
console.error = (...a) => { try { const __day = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(__path.join(__logsDir, `fatal-${__day}.log`), new Date().toISOString() + " " + a.map((x) => (typeof x === "string" ? x : JSON.stringify(x) || String(x))).join(" ") + "\n"); } catch {} origConsoleError(...a); };
/**
 * NovaRoute production entrypoint.
 * Loads custom-server.js first so the Next.js standalone server inherits
 * socket-IP stripping / h2c downgrade handling, then starts the standalone
 * server built by `next build`.
 */
const path = require("path");

process.env.PORT = process.env.PORT || "20126";
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const projectRoot = __dirname;

// Apply the http.createServer wrapper before Next.js loads.
require(path.join(projectRoot, "custom-server.js"));

// Start the Next.js standalone server produced by `npm run build`.
require(path.join(projectRoot, ".next", "standalone", "server.js"));
