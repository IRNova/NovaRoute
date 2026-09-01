// Detached update worker. Spawned by POST /api/github-update/apply and by
// POST /api/setup/update; survives the parent server exit, and reports
// progress into <appDir>/.update-status/status.json.
//
// Usage:
//   node githubUpdateWorker.js --mode=git --ref=main    (server install)
//   node githubUpdateWorker.js --mode=tag --ref=v1.2.3  (release tarball)
//   node githubUpdateWorker.js v1.2.3                   (legacy, = tag mode)
//
// Two things this worker exists to get right, both of which broke the previous
// inline updater:
//
//   1. install.sh finishes with `npm prune --omit=dev`, so tailwindcss and
//      postcss are NOT present on a live box. `next build` needs them, so the
//      install step must be a FULL `npm install` before the build, and the
//      prune is re-applied afterwards to restore the installed footprint.
//   2. `systemctl restart` kills this worker's own cgroup. The restart is
//      therefore handed to systemd-run so it outlives us, and the terminal
//      status is written BEFORE the restart is dispatched.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const REPO = process.env.GITHUB_UPDATE_REPO || "IRNova/NovaRoute";
const SERVICE = process.env.NOVAROUTE_SERVICE || "novaroute";
const appDir = process.cwd();
const statusDir = path.join(appDir, ".update-status");
const statusFile = path.join(statusDir, "status.json");
const logLines = [];

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { mode: "", ref: "" };
  for (const arg of argv) {
    const m = /^--(mode|ref)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
    else if (!out.ref) out.ref = arg; // legacy positional tag
  }
  if (!out.mode) out.mode = out.ref ? "tag" : "git";
  if (out.mode === "git" && !out.ref) out.ref = "main";
  return out;
}

const { mode, ref } = parseArgs(process.argv.slice(2));

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
let backupPath = "";

function writeStatus(extra) {
  const payload = {
    mode,
    ref,
    tag: mode === "tag" ? ref : null,
    backupPath: backupPath || null,
    ...extra,
    updatedAt: new Date().toISOString(),
    log: logLines.slice(-60),
  };
  fs.mkdirSync(statusDir, { recursive: true });
  fs.writeFileSync(statusFile, JSON.stringify(payload, null, 2));
}

function step(name, pct) {
  logLines.push(`[step] ${name} (${pct}%)`);
  writeStatus({ step: name, pct, done: false, error: null });
}

function run(cmd, opts = {}) {
  logLines.push(`$ ${cmd}`);
  let out;
  try {
    out = execSync(cmd, {
      cwd: appDir,
      encoding: "utf8",
      timeout: 900000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    });
  } catch (err) {
    // execSync throws before returning, so the command's own output is the
    // only useful diagnostic. Without this the status file just says
    // "Command failed" and the operator has nothing to act on.
    const detail = [err.stdout, err.stderr]
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .join("\n");
    if (detail) logLines.push(...detail.split("\n").slice(-20));
    throw err;
  } finally {
    if (out) {
      const lines = String(out).split("\n").map((l) => l.trimEnd()).filter(Boolean);
      logLines.push(...lines.slice(-20));
    }
  }
  return out;
}

function tryRun(cmd, opts = {}) {
  try {
    return run(cmd, opts);
  } catch {
    return "";
  }
}

function commandExists(bin) {
  try {
    execSync(`command -v ${bin}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function pkgVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Update sources
// ---------------------------------------------------------------------------

// install.sh clones with --depth 1, so a plain `git pull` has no merge base and
// aborts the moment the working tree drifts (next build rewrites tsconfig.json,
// which is tracked). Fetch + reset is what install.sh's own update path does.
function updateFromGit(branch) {
  if (!fs.existsSync(path.join(appDir, ".git"))) {
    throw new Error(`${appDir} is not a git checkout; reinstall with install.sh or use tag mode`);
  }
  run(`git fetch --depth 1 origin ${branch}`);
  run("git reset --hard FETCH_HEAD");
  const sha = tryRun("git rev-parse --short HEAD").trim();
  if (sha) logLines.push(`[info] now at ${sha}`);
}

function updateFromTag(tag) {
  const tmpTar = path.join(os.tmpdir(), `nova-update-${Date.now()}.tar.gz`);
  const url = `https://codeload.github.com/${REPO}/tar.gz/refs/tags/${tag}`;
  run(`curl -fSL --retry 2 --max-time 300 -o "${tmpTar}" "${url}"`);
  const size = fs.statSync(tmpTar).size;
  if (size < 10000) throw new Error(`Downloaded archive too small (${size} bytes)`);
  run(`tar -xzf "${tmpTar}" -C "${appDir}" --strip-components=1`);
  fs.rmSync(tmpTar, { force: true });
}

// The restart must outlive this process: systemctl restart tears down the
// service cgroup, and a detached child still lives inside it.
function dispatchRestart() {
  if (commandExists("systemd-run")) {
    const unit = `novaroute-update-restart-${Date.now()}`;
    tryRun(`systemd-run --collect --unit=${unit} --no-block /bin/systemctl restart ${SERVICE}`);
    return;
  }
  tryRun(`setsid /bin/systemctl restart ${SERVICE} >/dev/null 2>&1 &`, { shell: "/bin/bash" });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(function main() {
  try {
    if (mode !== "git" && mode !== "tag") throw new Error(`Unknown update mode: ${mode}`);
    if (mode === "tag" && !/^[A-Za-z0-9._-]+$/.test(ref)) throw new Error("A valid release tag is required");
    if (mode === "git" && !/^[A-Za-z0-9._\/-]+$/.test(ref)) throw new Error("A valid branch name is required");

    step("backup", 15);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    backupPath = path.join(os.homedir(), `nova-rollback-${pkgVersion()}-${stamp}.tar.gz`);
    run(
      `tar -czf "${backupPath}" -C "${path.dirname(appDir)}" ` +
      `--exclude='${path.basename(appDir)}/node_modules' ` +
      `--exclude='${path.basename(appDir)}/.next' ` +
      `--exclude='${path.basename(appDir)}/.update-status' ` +
      path.basename(appDir)
    );

    step("fetch", 35);
    if (mode === "git") updateFromGit(ref);
    else updateFromTag(ref);

    // FULL install: the live box has had its devDependencies pruned, and the
    // build needs tailwindcss/postcss back. --omit=dev here is what broke the
    // previous updater.
    step("install", 55);
    run("npm install --no-audit --no-fund");

    step("build", 75);
    run("npm run build");

    // Restore the pruned footprint install.sh leaves behind.
    step("prune", 90);
    tryRun("npm prune --omit=dev --no-audit --no-fund");

    step("restarting", 96);
    // Terminal status is written first: this process dies with the restart.
    writeStatus({ step: "done", pct: 100, done: true, error: null, version: pkgVersion() });
    dispatchRestart();
    process.exit(0);
  } catch (err) {
    logLines.push(`[error] ${err.message}`);
    if (backupPath) {
      logLines.push(`[rollback] tar -xzf "${backupPath}" -C "${path.dirname(appDir)}" && systemctl restart ${SERVICE}`);
    }
    writeStatus({ step: "error", pct: 100, done: true, error: err.message });
    process.exit(1);
  }
})();
