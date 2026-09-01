// The generic provider probe. Runs with: node --test "tests/unit/*.test.js"
//
// Only ~80 of 368 providers had a hand-written test entry. The rest returned
// "Provider test not supported" as valid:false, which was stored as
// testStatus "error", so pressing Test marked working providers permanently
// broken and other code then skipped them.
import test from "node:test";
import assert from "node:assert/strict";
import "./aliasHook.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { deriveModelsUrl, buildRegistryAuthHeaders } = await import(
  "../../src/app/api/providers/[id]/test/testUtils.js"
);
const { default: REGISTRY } = await import("open-sse/providers/registry/index.js");

test("a chat endpoint becomes the models endpoint beside it", () => {
  const cases = [
    ["https://api.zukijourney.com/v1/chat/completions", "https://api.zukijourney.com/v1/models"],
    ["https://api.openai.com/v1/chat/completions", "https://api.openai.com/v1/models"],
    ["https://x.test/anthropic/v1/messages", "https://x.test/anthropic/v1/models"],
    ["https://x.test/v1/responses", "https://x.test/v1/models"],
    ["https://x.test/v1/", "https://x.test/v1/models"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(deriveModelsUrl(input), expected, input);
  }
});

test("a query string or fragment never leaks into the probe URL", () => {
  assert.equal(
    deriveModelsUrl("https://x.test/v1/chat/completions?key=secret#frag"),
    "https://x.test/v1/models"
  );
});

test("an unusable base URL yields no probe rather than a bad one", () => {
  for (const bad of [null, undefined, "", "not a url", 42]) {
    assert.equal(deriveModelsUrl(bad), null, String(bad));
  }
});

test("auth headers follow what the registry declares", () => {
  assert.deepEqual(buildRegistryAuthHeaders({ header: "Authorization", scheme: "bearer" }, "k"), {
    Authorization: "Bearer k",
    Accept: "application/json",
  });
  // raw means the key goes in verbatim, with no scheme prefix
  assert.deepEqual(buildRegistryAuthHeaders({ header: "x-api-key", scheme: "raw" }, "k"), {
    "x-api-key": "k",
    Accept: "application/json",
  });
  assert.deepEqual(buildRegistryAuthHeaders({ header: "Authorization", scheme: "Token" }, "k"), {
    Authorization: "Token k",
    Accept: "application/json",
  });
  // A custom header with no scheme carries the bare key, not "Bearer k".
  assert.deepEqual(buildRegistryAuthHeaders({ header: "x-portkey-api-key" }, "k"), {
    "x-portkey-api-key": "k",
    Accept: "application/json",
  });
  // No auth block at all: the OpenAI-compatible convention.
  assert.deepEqual(buildRegistryAuthHeaders(undefined, "k"), {
    Authorization: "Bearer k",
    Accept: "application/json",
  });
});

test("the probe covers most of the API key catalog", () => {
  const apikey = REGISTRY.filter((r) => r.category === "apikey");
  const probeable = apikey.filter((r) => deriveModelsUrl(r.transport?.baseUrl));
  assert.ok(apikey.length > 200, `expected a large api-key catalog, got ${apikey.length}`);
  assert.ok(
    probeable.length / apikey.length > 0.8,
    `only ${probeable.length}/${apikey.length} api-key providers can be probed`
  );
});
