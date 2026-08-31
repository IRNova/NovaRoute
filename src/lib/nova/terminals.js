// Nova Bot — persistent terminal sessions (Hermes terminal_tool style, safe).
// A "session" is a long-lived /bin/bash child with piped stdin/stdout and a
// ring buffer. Commands written to it go through the standard approval flow.
// Interactive full-screen apps (vim/top) are not supported — use one-shot
// `terminal` for those.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createPendingApproval, waitForDecision } from "./tools.js";

const SESSIONS = new Map(); // name -> { child, buffer: string[], alive }
const BUFFER_LINES = 400;
const IDLE_KILL_MS = 10 * 60_000;

function push(sess, text) {
  for (const line of String(text).split("\n")) {
    sess.buffer.push(line);
  }
  if (sess.buffer.length > BUFFER_LINES) {
    sess.buffer.splice(0, sess.buffer.length - BUFFER_LINES);
  }
}

export function termOpen({ name, cwd }) {
  const sName = String(name || "main").slice(0, 40);
  if (SESSIONS.has(sName)) {
    const s = SESSIONS.get(sName);
    if (s.alive) return `Session "${sName}" already open.`;
    SESSIONS.delete(sName);
  }

  let approved = null;
  return (async () => {
    const item = await createPendingApproval({
      command: `[term-open] ${sName}${cwd ? ` in ${cwd}` : ""}`,
      agentName: "terminal-session",
    });
    approved = await waitForDecision(item.id);
    if (!approved) return "DENIED by admin.";

    const child = spawn("/bin/bash", ["--norc", "-i"], { cwd: cwd || undefined, stdio: ["pipe", "pipe", "pipe"] });
    const sess = { child, buffer: [`(session ${sName} opened pid ${child.pid})`], alive: true, lastUsed: Date.now(), name: sName };
    SESSIONS.set(sName, sess);

    child.stdout.on("data", (d) => push(sess, d.toString()));
    child.stderr.on("data", (d) => push(sess, d.toString()));
    child.on("exit", (code) => {
      sess.alive = false;
      push(sess, `(session exited code ${code})`);
    });

    const idle = setTimeout(() => {
      if (sess.alive) { try { child.kill(); } catch {} }
    }, IDLE_KILL_MS);
    idle.unref?.();

    return `Session "${sName}" opened (pid ${child.pid}). Use term_write/term_read.`;
  })();
}

async function gateCommand(cmd) {
  const item = await createPendingApproval({
    command: `[term] ${String(cmd).slice(0, 300)}`,
    agentName: "terminal-session",
  });
  meta0?.onEvent?.({ type: "approval", id: item.id, command: cmd });
  return waitForDecision(item.id);
}

let meta0 = null;

export function setToolMeta(meta) {
  meta0 = meta || null;
}

export async function termWrite({ session, command }) {
  const sName = String(session || "main").slice(0, 40);
  const sess = SESSIONS.get(sName);
  if (!sess?.alive) return `ERROR: session "${sName}" not open (term_open first).`;
  const cmd = String(command || "").trim();
  if (!cmd) return "ERROR: empty command.";

  const ok = await gateCommand(cmd);
  if (!ok) return "DENIED by admin.";

  sess.lastUsed = Date.now();
  push(sess, `$ ${cmd}`);
  try {
    sess.child.stdin.write(cmd + "\n");
    // Give short-running commands a moment to produce output.
    await new Promise((r) => setTimeout(r, 600));
    return readBuffer(sess, 60).join("\n");
  } catch (e) {
    return `ERROR: ${String(e?.message || e).slice(0, 200)}`;
  }
}

function readBuffer(sess, maxLines) {
  const lines = sess.buffer.slice(-maxLines);
  return lines.length ? lines : ["(no output yet — use term_read again shortly)"];
}

export function termRead({ session }) {
  const sess = SESSIONS.get(String(session || "main").slice(0, 40));
  if (!sess) return `No session. Open ones: ${[...SESSIONS.keys()].join(", ") || "(none)"}`;
  return readBuffer(sess, 120).join("\n");
}

export function termClose({ session }) {
  const sName = String(session || "main").slice(0, 40);
  const sess = SESSIONS.get(sName);
  if (!sess) return `No session "${sName}".`;
  try { sess.child.kill(); } catch {}
  SESSIONS.delete(sName);
  return `Session "${sName}" closed.`;
}

export function termList() {
  const out = [];
  for (const [name, s] of SESSIONS) {
    out.push(`${name}: ${s.alive ? `alive (pid ${s.child.pid})` : "dead"} · idle ${Math.round((Date.now() - s.lastUsed) / 1000)}s`);
  }
  return out.join("\n") || "(no sessions)";
}
