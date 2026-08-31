// Nova Bot — git worktree isolation (Hermes subagent_worktree style).
// Experimental code-editing sandboxes: each worktree is a separate checkout
// under /tmp/nova-wt/<name> so agents can build/test without touching the
// running app. Every mutating step goes through the standard approval flow.

import { execFile } from "node:child_process";
import { createPendingApproval, waitForDecision } from "./tools.js";

const WT_ROOT = "/tmp/nova-wt";
const APP_DIR = process.cwd();

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 60_000, encoding: "utf8", cwd: opts.cwd || APP_DIR, maxBuffer: 2_000_000 }, (err, stdout, stderr) => {
      resolve({ code: err?.code ?? 0, out: `${stdout || ""}${stderr ? "\n" + stderr : ""}`.trim() });
    });
  });
}

async function gate(command) {
  const item = await createPendingApproval({ command, agentName: "worktree" });
  return waitForDecision(item.id);
}

export async function wtCreate({ name }) {
  const sName = String(name || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 30);
  if (!sName) return "ERROR: name required (alphanumeric/dash).";

  const check = await run("git", ["rev-parse", "--is-inside-work-tree"]);
  if (!check.out.includes("true")) {
    return "ERROR: current directory is not a git repo — worktrees need one.";
  }

  if (!(await gate(`git worktree add ${WT_ROOT}/${sName} -b nova/${sName}`))) {
    return "DENIED by admin.";
  }
  const r = await run("git", ["worktree", "add", `${WT_ROOT}/${sName}`, `-b`, `nova/${sName}`]);
  return r.code === 0
    ? `Worktree "${sName}" ready at ${WT_ROOT}/${sName} (branch nova/${sName}). Use wt_cmd to run inside it.`
    : `ERROR: ${r.out.slice(0, 300)}`;
}

export async function wtCmd({ name, command }) {
  const dir = `${WT_ROOT}/${String(name || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 30)}`;
  if (!command) return "ERROR: command required.";
  if (!(await gate(`[wt:${name}] ${command.slice(0, 250)}`))) return "DENIED by admin.";

  return new Promise((resolve) => {
    execFile(
      "/bin/bash",
      ["-c", String(command).slice(0, 2000)],
      { cwd: dir, timeout: 120_000, maxBuffer: 4_000_000, encoding: "utf8" },
      (err, stdout, stderr) => {
        let out = stdout || "";
        if (stderr) out += `\n--- stderr ---\n${stderr}`;
        if (!out.trim()) out = `(exit ${err?.code ?? 0}, no output)`;
        resolve(`exit ${err?.code ?? 0}\n${out.slice(0, 10_000)}`);
      }
    );
  });
}

export async function wtDiff({ name }) {
  const dir = `${WT_ROOT}/${String(name || "").replace(/[^a-zA-Z0-9-]/g, "")}`;
  const r = await run("git", ["diff", "--stat", "HEAD"], { cwd: dir });
  const patch = await run("git", ["diff", "HEAD"], { cwd: dir });
  const body = patch.out.length > 8000 ? patch.out.slice(0, 8000) + `\n…[${patch.out.length} chars total]` : patch.out;
  return `-- stat --\n${r.out || "(no changes)"}\n\n-- patch --\n${body}`;
}

export async function wtRemove({ name }) {
  const sName = String(name || "").replace(/[^a-zA-Z0-9-]/g, "");
  if (!(await gate(`git worktree remove --force ${WT_ROOT}/${sName} + branch -D`))) return "DENIED by admin.";
  const r1 = await run("git", ["worktree", "remove", "--force", `${WT_ROOT}/${sName}`]);
  const r2 = await run("git", ["branch", "-D", `nova/${sName}`]);
  return `Removed worktree (${r1.code}) and branch (${r2.code}).`;
}
