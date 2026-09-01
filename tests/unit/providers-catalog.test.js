// Provider catalog: registration and auth-method truthfulness.
// Runs with: node --test "tests/unit/*.test.js"
//
// Two failures this locks out. Eleven providers once had an import line in the
// registry index but were missing from its exported array, so they existed on
// disk, had logos, and in one case a whole OAuth handler, while being invisible
// to both the dashboard and the gateway. And fifteen providers that need no
// credential were advertised as needing an API key.
import test from "node:test";
import assert from "node:assert/strict";
import "./aliasHook.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// The catalog is app code and uses the bundler's aliases, so give plain node
// the same two mappings jsconfig.json gives Next.
const { AI_PROVIDERS, resolveDisplayAuthType, resolveAuthModes } = await import("@/shared/constants/providers");
const { default: REGISTRY } = await import("open-sse/providers/registry/index.js");
const { resolveContextWindow, getCapabilitiesForModel } = await import("open-sse/providers/capabilities.js");
const { buildIndex } = await import("../../scripts/generate-registry-index.mjs");

const REGISTRY_DIR = path.join(ROOT, "open-sse", "providers", "registry");

// Mirrors GROUP_META in the providers dashboard. A provider whose resolved auth
// type is not one of these renders in no group at all, which is silent.
const RENDERED_GROUPS = ["none", "apikey", "oauth", "cookie", "cli", "local", "compatible"];

test("every registry file is exported by the index", () => {
  const files = fs.readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".js") && f !== "index.js");
  assert.equal(
    REGISTRY.length,
    files.length,
    `${files.length} registry files but ${REGISTRY.length} exported: run node scripts/generate-registry-index.mjs`
  );
});

test("the registry index is what the generator would write", () => {
  const onDisk = fs.readFileSync(path.join(REGISTRY_DIR, "index.js"), "utf8");
  assert.equal(onDisk, buildIndex(REGISTRY_DIR), "registry index is stale: run node scripts/generate-registry-index.mjs");
});

test("no two providers share an id", () => {
  const seen = new Map();
  for (const r of REGISTRY) {
    assert.equal(seen.has(r.id), false, `duplicate provider id: ${r.id}`);
    seen.set(r.id, true);
  }
  // The catalog is keyed by id, so a collision silently drops a provider.
  assert.equal(Object.keys(AI_PROVIDERS).length, REGISTRY.length);
});

test("every provider lands in a group the dashboard renders", () => {
  const orphans = [];
  for (const [id, p] of Object.entries(AI_PROVIDERS)) {
    if (p.hidden) continue;
    const group = resolveDisplayAuthType(id, p);
    if (!RENDERED_GROUPS.includes(group)) orphans.push(`${id} -> ${group}`);
  }
  assert.deepEqual(orphans, [], "these providers would render nowhere");
});

test("a provider that needs no credential is not advertised as needing one", () => {
  const raw = new Map(REGISTRY.map((r) => [r.id, r]));
  const lying = [];
  for (const [id, p] of Object.entries(AI_PROVIDERS)) {
    const entry = raw.get(id) || {};
    const keyless = entry.noAuth === true || entry.authType === "none";
    if (keyless && resolveDisplayAuthType(id, p) === "apikey") lying.push(id);
  }
  assert.deepEqual(lying, [], "shown as API Key but declared keyless");
});

test("keyless providers resolve to the no-key mode", () => {
  // AI Horde accepts an optional key for queue priority; it still needs none.
  assert.equal(resolveDisplayAuthType("aihorde", AI_PROVIDERS.aihorde), "none");
  assert.equal(resolveDisplayAuthType("edge-tts", AI_PROVIDERS["edge-tts"]), "none");
});

test("an interactive connect flow still outranks the no-key mode", () => {
  // A local runtime or a cookie provider must keep its own flow even if it
  // happens to need no credential.
  for (const [id, p] of Object.entries(AI_PROVIDERS)) {
    const modes = resolveAuthModes(id, p);
    if (modes.includes("none") && modes.some((m) => ["cookie", "cli", "local", "oauth"].includes(m))) {
      assert.notEqual(resolveDisplayAuthType(id, p), "none", `${id} lost its connect flow`);
    }
  }
});

test("ordinary API key providers are unaffected", () => {
  for (const id of ["openai", "anthropic", "groq"]) {
    if (!AI_PROVIDERS[id]) continue;
    assert.equal(resolveDisplayAuthType(id, AI_PROVIDERS[id]), "apikey", id);
  }
});

// ── context windows ────────────────────────────────────────────────────────
// getCapabilitiesForModel merges over a floor of 200000, so it answers 200000
// for anything it does not recognise, including TTS voice ids. The quota page
// divided usage by that number and drew a percentage from it.

const registryById = new Map(REGISTRY.map((r) => [r.id, r]));

test("a model nothing knows about reports unknown, not the 200k floor", () => {
  for (const [provider, model] of [
    ["zukijourney", "totally-made-up-model"],
    ["unknown-provider", "xyzzy-1"],
    ["edge-tts", "en-US-AriaNeural"],
  ]) {
    // The floor is what we are guarding against, so assert it is still there.
    assert.equal(getCapabilitiesForModel(provider, model).contextWindow, 200000);
    assert.equal(
      resolveContextWindow(provider, model, registryById.get(provider)),
      null,
      `${provider}/${model} should be unknown`
    );
  }
});

test("known models keep their real context window", () => {
  assert.equal(resolveContextWindow("openai", "gpt-4o", registryById.get("openai")), 128000);
  assert.equal(resolveContextWindow("openai", "gpt-4.1", registryById.get("openai")), 1000000);
  assert.equal(resolveContextWindow("anthropic", "claude-3-haiku", registryById.get("anthropic")), 200000);
});

test("the provider registry wins over the generic capability tables", () => {
  // Both field spellings are in use across registry files.
  const entry = { models: [{ id: "m-a", contextLength: 8192 }, { id: "m-b", contextWindow: 32768 }] };
  assert.equal(resolveContextWindow("whatever", "m-a", entry), 8192);
  assert.equal(resolveContextWindow("whatever", "m-b", entry), 32768);
});

test("a vendor-prefixed model id still matches its registry entry", () => {
  const entry = { models: [{ id: "gpt-4o", contextLength: 111 }] };
  assert.equal(resolveContextWindow("x", "openai/gpt-4o", entry), 111);
});

test("a registry entry without a context value falls through, it does not return zero", () => {
  const entry = { models: [{ id: "gpt-4o" }] };
  assert.equal(resolveContextWindow("openai", "gpt-4o", entry), 128000);
});

test("most of the catalog resolves to a real limit", () => {
  let known = 0, total = 0;
  for (const r of REGISTRY) {
    for (const m of r.models || []) {
      total++;
      if (resolveContextWindow(r.id, m.id, r) !== null) known++;
    }
  }
  assert.ok(total > 2000, `expected a large catalog, got ${total}`);
  assert.ok(known / total > 0.8, `only ${known}/${total} models have a real context window`);
});
