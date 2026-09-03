// Model extraction honesty. Runs with: node --test "tests/unit/*.test.js"
//
// "In many providers the extraction does nothing at all, or it doesn't extract
// the model accurately. Because the model names are wrong and don't match the
// actual provider, they don't work."
//
// When a provider's live model endpoint does not answer, extraction falls back
// to the built-in catalogue. That is a reasonable fallback and a terrible lie:
// the route dropped the `static` flag from its response, so the dashboard
// marked every one of those models "live" and showed no warning. Measured
// against the providers that need no credential, 27 of 28 were served from the
// built-in list this way.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const route = fs.readFileSync(path.join(ROOT, "src/app/api/providers/extract-models/route.js"), "utf8");
const modal = fs.readFileSync(
  path.join(ROOT, "src/app/(dashboard)/dashboard/providers/components/ProviderEditModal.js"),
  "utf8"
);

test("the response says whether the list came from the provider or the built-in catalogue", () => {
  assert.match(route, /static:\s*Boolean\(result\.static\)/, "the static flag is dropped again");
});

test("the response carries the reason the live list was not used", () => {
  assert.match(route, /warning:\s*warning\s*\|\|\s*null/);
});

test("the dashboard tells the operator when the list is the built-in one", () => {
  const idx = modal.indexOf('extract-models');
  assert.ok(idx > -1);
  const block = modal.slice(idx, idx + 1600);
  assert.match(block, /if \(data\.static\)/, "the fallback is not surfaced");
  assert.match(block, /setModelsError\(/, "nothing is shown to the operator");
});

test("models keep their provenance so the two cannot be confused later", () => {
  const idx = modal.indexOf('extract-models');
  const block = modal.slice(idx, idx + 1600);
  assert.match(block, /source: data\.static \? "default" : "live"/);
});
