// Changelog and version display. Runs with: node --test "tests/unit/*.test.js"
//
// /api/changelog serves markdown and the page called .json() on it, so the
// parse always threw and the page rendered a hardcoded SAMPLE_CHANGELOG.
// Every operator saw invented release notes instead of the ones shipped with
// their build. And the sidebar version was a hardcoded string that no release
// could change.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseChangelog } from "../../src/shared/utils/parseChangelog.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHANGELOG = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("the shipped changelog parses into releases", () => {
  const entries = parseChangelog(CHANGELOG);
  assert.ok(entries.length >= 2, `expected several releases, got ${entries.length}`);
  for (const e of entries) {
    assert.match(e.version, /^\d+\.\d+/, `bad version: ${e.version}`);
    assert.ok(Array.isArray(e.changes));
  }
});

test("the newest release matches the version this build reports", () => {
  // A release whose notes do not match package.json is how "which version am I
  // on" stops being answerable.
  const [newest] = parseChangelog(CHANGELOG);
  assert.equal(newest.version, pkg.version, "CHANGELOG head and package.json disagree");
});

test("the current release has a date and real entries", () => {
  const [newest] = parseChangelog(CHANGELOG);
  assert.match(newest.date, /^\d{4}-\d{2}-\d{2}$/, `bad date: ${newest.date}`);
  assert.ok(newest.changes.length > 10, `only ${newest.changes.length} entries`);
});

test("section headings become change types", () => {
  const md = [
    "# v2.0.0 (2026-01-02)",
    "## Features",
    "- **Area**: added a thing",
    "## Fixes",
    "- fixed a thing",
    "## Security",
    "- hardening",
    "## Breaking",
    "- removed a thing",
  ].join("\n");
  const [e] = parseChangelog(md);
  assert.deepEqual(e.changes.map((c) => c.type), ["feature", "fix", "security", "breaking"]);
  // Markdown emphasis must not survive into a text node as literal asterisks.
  assert.equal(e.changes[0].text, "Area: added a thing");
});

test("a bullet wrapped over several lines is joined, not truncated", () => {
  const md = [
    "# v1.0.0 (2026-01-01)",
    "## Fixes",
    "- **Update**: the first part of the sentence",
    "  continues here",
    "  and ends here",
    "- second bullet",
  ].join("\n");
  const [e] = parseChangelog(md);
  assert.equal(e.changes.length, 2);
  assert.equal(e.changes[0].text, "Update: the first part of the sentence continues here and ends here");
});

test("malformed input yields nothing rather than throwing", () => {
  for (const bad of ["", null, undefined, 42, "no headings at all", "## Fixes\n- orphan bullet"]) {
    assert.deepEqual(parseChangelog(bad), [], `threw or invented entries for ${JSON.stringify(bad)}`);
  }
});

test("the changelog page no longer carries hardcoded sample entries", () => {
  const page = fs.readFileSync(path.join(ROOT, "src/app/(dashboard)/dashboard/changelog/page.js"), "utf8");
  assert.ok(!page.includes("SAMPLE_CHANGELOG"), "the placeholder data is back");
  assert.ok(!/\.then\(\s*\(r\)\s*=>\s*r\.json\(\)\s*\)/.test(page), "markdown is being parsed as JSON again");
});

test("the displayed version is derived from package.json, not hardcoded", () => {
  const cfg = fs.readFileSync(path.join(ROOT, "src/shared/constants/config.js"), "utf8");
  assert.ok(/versionLabel:\s*`v\$\{pkg\.version\}`/.test(cfg), "versionLabel is hardcoded again");
  assert.ok(!/versionLabel:\s*"/.test(cfg), "versionLabel is a literal string again");
});
