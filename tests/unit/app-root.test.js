// Locating the install directory. Runs with: node --test "tests/unit/*.test.js"
//
// The Next standalone server calls process.chdir(__dirname) on boot, so a
// running install reports <install>/.next/standalone as its cwd. Everything in
// the updater derived the app root from cwd, which meant the update button
// could not find its worker, reported a real git checkout as "not a git
// checkout", and would have run npm install and next build inside the build
// output, which has a package.json of its own.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveAppRoot } from "../../src/lib/updater/appRoot.js";

function fixture(fn) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "nova-root-"));
  const root = path.join(base, "opt", "novaroute");
  const standalone = path.join(root, ".next", "standalone");
  fs.mkdirSync(path.join(standalone, "src", "lib", "updater"), { recursive: true });
  // The real root.
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"novaroute-app"}');
  fs.writeFileSync(path.join(root, "next.config.mjs"), "export default {};");
  fs.mkdirSync(path.join(root, "src", "lib", "updater"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "lib", "updater", "githubUpdateWorker.js"), "");
  // The decoy Next writes: its own package.json plus a traced copy of src/.
  fs.writeFileSync(path.join(standalone, "package.json"), '{"name":"novaroute-app"}');
  fs.writeFileSync(path.join(standalone, "src", "lib", "updater", "githubUpdateWorker.js"), "");
  const saved = process.env.INSTALL_DIR;
  delete process.env.INSTALL_DIR;
  try {
    return fn({ root, standalone });
  } finally {
    if (saved === undefined) delete process.env.INSTALL_DIR;
    else process.env.INSTALL_DIR = saved;
    fs.rmSync(base, { recursive: true, force: true });
  }
}

test("started from the install directory, it is the install directory", () => {
  fixture(({ root }) => assert.equal(resolveAppRoot(root), root));
});

test("started from .next/standalone, it walks up to the install directory", () => {
  // This is the case that actually happens in production.
  fixture(({ root, standalone }) => assert.equal(resolveAppRoot(standalone), root));
});

test("the build output is not mistaken for the root despite its package.json and src copy", () => {
  fixture(({ root, standalone }) => {
    assert.notEqual(resolveAppRoot(standalone), standalone);
    assert.equal(resolveAppRoot(standalone), root);
  });
});

test("INSTALL_DIR wins when it points at a real install", () => {
  fixture(({ root, standalone }) => {
    process.env.INSTALL_DIR = root;
    try {
      assert.equal(resolveAppRoot(standalone), root);
    } finally {
      delete process.env.INSTALL_DIR;
    }
  });
});

test("a bogus INSTALL_DIR does not win over a real install found by walking up", () => {
  fixture(({ root, standalone }) => {
    process.env.INSTALL_DIR = path.join(os.tmpdir(), "definitely-not-an-install");
    try {
      assert.equal(resolveAppRoot(standalone), root);
    } finally {
      delete process.env.INSTALL_DIR;
    }
  });
});

test("an unrecognisable directory resolves to itself rather than guessing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nova-none-"));
  try {
    assert.equal(resolveAppRoot(dir), path.resolve(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the worker resolves its own app dir the same way, without importing", () => {
  // The worker is CommonJS, spawned as a separate process, so it carries its
  // own copy of this logic. If the two drift, the update writes to one place
  // and the panel reads another.
  const worker = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "src/lib/updater/githubUpdateWorker.js"),
    "utf8"
  );
  assert.ok(!/const appDir = process\.cwd\(\);/.test(worker), "worker is back on cwd");
  assert.ok(worker.includes("next.config.mjs"), "worker does not use the root marker");
});
