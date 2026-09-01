// Farsi dictionary quality. Runs with: node --test "tests/unit/*.test.js"
//
// The runtime translator looks strings up by their exact English source, so the
// dictionary is only as good as its coverage, and a mixed Farsi/Latin value
// renders in the wrong order unless the Latin run is isolated.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DICT = path.join(ROOT, "public/i18n/literals/fa.json");

const LRI = "⁦"; // LEFT-TO-RIGHT ISOLATE
const PDI = "⁩"; // POP DIRECTIONAL ISOLATE
const HAS_FA = /[؀-ۿ]/;
const HAS_LATIN = /[A-Za-z]{2}/;

const fa = JSON.parse(fs.readFileSync(DICT, "utf8"));

function sourceFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(full, acc);
    else if (e.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

const sources = sourceFiles(path.join(ROOT, "src")).map((f) => fs.readFileSync(f, "utf8"));

test("the dictionary is valid and non-trivial", () => {
  assert.ok(Object.keys(fa).length > 3000, `only ${Object.keys(fa).length} entries`);
  for (const [k, v] of Object.entries(fa)) {
    assert.equal(typeof v, "string", `value for ${k} is not a string`);
  }
});

test("every directional isolate is closed", () => {
  // An unclosed LRI leaks its direction into the rest of the paragraph, which
  // scrambles the layout of everything after it.
  const broken = Object.entries(fa)
    .filter(([, v]) => (v.split(LRI).length - 1) !== (v.split(PDI).length - 1))
    .map(([k]) => k);
  assert.deepEqual(broken, [], "unbalanced LRI/PDI");
});

test("mixed Farsi and Latin values isolate their Latin runs", () => {
  // Without isolation, "Cloudflare با موفقیت متصل شد" renders with the Latin
  // word thrown to the wrong end of the line.
  const unisolated = Object.entries(fa)
    .filter(([, v]) => HAS_FA.test(v) && HAS_LATIN.test(v) && !v.includes(LRI))
    .map(([k]) => k);
  assert.deepEqual(unisolated.slice(0, 10), [], `${unisolated.length} mixed values are not isolated`);
});

test("translate() literals are covered", () => {
  const literals = new Set();
  for (const s of sources) {
    for (const m of s.matchAll(/translate\(\s*(["'])(.*?)\1\s*\)/gs)) {
      const t = m[2].trim();
      // Source-level escapes are not what reaches the runtime.
      if (t && !t.includes("\\\"")) literals.add(t);
    }
  }
  const missing = [...literals].filter((t) => !Object.hasOwn(fa, t));
  assert.ok(literals.size > 1000, `expected many literals, found ${literals.size}`);
  assert.ok(
    missing.length / literals.size < 0.02,
    `${missing.length}/${literals.size} translate() literals have no Farsi: ${missing.slice(0, 8).join(" | ")}`
  );
});

test("no entry is left as its own English source", () => {
  // A key whose value is the identical English string is an untranslated
  // placeholder pretending to be done.
  const identical = Object.entries(fa)
    .filter(([k, v]) => k === v && HAS_LATIN.test(k) && k.split(" ").length > 1)
    .map(([k]) => k);
  assert.ok(identical.length < 60, `${identical.length} entries are still their English source`);
});

test("isolates never wrap the whole of a Latin-only value", () => {
  // A value with no Farsi needs no isolation; adding it there is noise.
  const noise = Object.entries(fa)
    .filter(([, v]) => v.includes(LRI) && !HAS_FA.test(v))
    .map(([k]) => k);
  assert.deepEqual(noise, []);
});
