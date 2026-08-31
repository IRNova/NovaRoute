// Detached GitHub auto-update worker.
// Spawned by POST /api/github-update/apply; survives the parent server exit,
// walks through download -> backup -> extract -> install -> build -> restart,
// and reports progress into <appDir>/.update-status/status.json.
//
// Usage: node githubUpdateWorker.js <tag>
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const tag = process.argv[2] || "";
const REPO = process.env.GITHUB_UPDATE_REPO || "IRNova/NovaRoute";
const appDir = process.cwd();
const statusDir = path.join(appDir, ".update-status");
const statusFile = path.join(statusDir, "status.json");
const logLines = [];

function writeStatus(extra) {
  const payload = {
    tag,
    ...extra,
    updatedAt: new Date().toISOString(),
    log: logLines.slice(-40),
  };
  fs.mkdirSync(statusDir, { recursive: true });
  fs.writeFileSync(statusFile, JSON.stringify(payload, null, 2));
}

function step(step, pct) {
  logLines.push(`[step] ${step} (${pct}%)`);
  writeStatus({ step, pct, done: false, error: null });
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
  } finally {
    if (out) {
      const lines = String(out).split("\n").map((l) => l.trimEnd()).filter(Boolean);
      logLines.push(...lines.slice(-20));
    }
  }
  return out;
}

(async () => {
  if (!tag) {
    writeStatus({ step: "error", pct: 100, done: true, error: "Missing tag argument" });
    process.exit(1);
  }

  const tmpTar = path.join(os.tmpdir(), `nova-update-${Date.now()}.tar.gz`);

  try {
    step("download", 5);
    const url = `https://codeload.github.com/${REPO}/tar.gz/refs/tags/${tag}`;
    run(`curl -fSL --retry 2 --max-time 300 -o "${tmpTar}" "${url}"`);
    const size = fs.statSync(tmpTar).size;
    if (size < 10000) throw new Error(`Downloaded archive too small (${size} bytes)`);

    step("backup", 25);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = path.join(os.homedir(), `nova-rollback-${pkgSafeVersion()}-${stamp}.tar.gz`);
    run(
      `tar -czf "${backupPath}" -C "${path.dirname(appDir)}" ` +
      `--exclude='${path.basename(appDir)}/node_modules' ` +
      `--exclude='${path.basename(appDir)}/.next' ` +
      `--exclude='${path.basename(appDir)}/.update-status' ` +
      path.basename(appDir)
    );

    step("extract", 45);
    run(`tar -xzf "${tmpTar}" -C "${appDir}" --strip-components=1`);
    fs.rmSync(tmpTar, { force: true });

    step("install", 60);
    run("npm install --no-audit --no-fund");

    step("build", 78);
    run("npm run build");

    step("restarting", 96);
    // Mark done BEFORE restarting: this process dies with the service.
    writeStatus({ step: "done", pct: 100, done: true, error: null });
    run("systemctl restart novaroute");
    process.exit(0);
  } catch (err) {
    logLines.push(`[error] ${err.message}`);
    writeStatus({ step: "error", pct: 100, done: true, error: err.message });
    process.exit(1);
  }
})();

function pkgSafeVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(appDir, "package.json"), "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}
