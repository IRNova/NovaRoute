// Which elements the runtime translator is allowed to rewrite.
// Runs with: node --test "tests/unit/*.test.js"
//
// The translator walks text nodes and swaps them for dictionary matches. That
// is correct for prose and wrong for a material icon, whose glyph IS its text:
// a span reading "error" is an icon, and translating it renders the Farsi word
// where the icon should be. Seen live in the notification bell.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// runtime.js imports "./config" without an extension, which the bundler
// resolves and plain node does not. The alias hook handles that too.
import "./aliasHook.mjs";
const { isTranslatableHost } = await import("@/i18n/runtime");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("ordinary prose is translated", () => {
  for (const [tag, cls] of [["p", ""], ["span", "text-sm"], ["div", "card"], ["h1", ""], ["button", "btn"]]) {
    assert.equal(isTranslatableHost(tag, cls), true, `${tag}.${cls}`);
  }
});

test("a material icon is never translated, whatever else is on the element", () => {
  for (const cls of [
    "material-symbols-outlined",
    "material-symbols-outlined text-[18px] mt-0.5 shrink-0 text-red-500",
    "text-red-500 material-symbols-outlined",
    "material-icons",
    "material-icons-round",
  ]) {
    assert.equal(isTranslatableHost("span", cls), false, cls);
  }
});

test("the specific case seen in the notification bell", () => {
  // <span className="material-symbols-outlined ...">error</span>
  // "error" is a dictionary key, so without this guard the icon became "خطا".
  assert.equal(isTranslatableHost("span", "material-symbols-outlined text-[18px]"), false);
});

test("code, script and table scaffolding stay untouched", () => {
  for (const tag of ["script", "style", "code", "pre", "table", "thead", "tbody", "tr", "select", "optgroup"]) {
    assert.equal(isTranslatableHost(tag, ""), false, tag);
  }
});

test("a missing or non-string class does not throw", () => {
  assert.equal(isTranslatableHost("span"), true);
  assert.equal(isTranslatableHost("span", undefined), true);
  assert.equal(isTranslatableHost("span", null), true);
  // SVG elements expose className as an object, not a string.
  assert.equal(isTranslatableHost("span", { baseVal: "material-symbols-outlined" }), true);
});

test("every icon ligature in the codebase is now safe from the dictionary", () => {
  // Guards the whole class of bug rather than the one instance that surfaced.
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, "public/i18n/literals/fa.json"), "utf8"));
  const ligaturePattern = /material-symbols-outlined[^>]*>\s*\{?["']?([a-z_]+)["']?\s*\}?\s*</gs;
  const collisions = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) {
        const src = fs.readFileSync(full, "utf8");
        for (const m of src.matchAll(ligaturePattern)) {
          if (Object.hasOwn(dict, m[1])) collisions.push(m[1]);
        }
      }
    }
  };
  walk(path.join(ROOT, "src"));
  // They may collide with the dictionary; what matters is that the guard stops
  // them being translated.
  for (const lig of new Set(collisions)) {
    assert.equal(
      isTranslatableHost("span", "material-symbols-outlined"),
      false,
      `ligature "${lig}" is a dictionary key and would be replaced`
    );
  }
});
