// Per-key gateway rate limiting. Runs with: node --test "tests/unit/*.test.js"
import test from "node:test";
import assert from "node:assert/strict";

import {
  checkKeyRateLimit,
  beginKeyRequest,
  getKeyRateState,
  listKeyRateStates,
  __resetForTests,
} from "../../src/lib/security/keyRateLimiter.js";

test("a key with no limits is never throttled", () => {
  __resetForTests();
  const key = { id: "free" };
  for (let i = 0; i < 500; i++) {
    assert.equal(checkKeyRateLimit(key).allowed, true);
  }
  assert.deepEqual(getKeyRateState("free"), { used: 0, active: 0 });
});

test("requests-per-minute cap admits exactly the limit, then refuses", () => {
  __resetForTests();
  const key = { id: "capped", rpmLimit: 3 };
  const now = Date.now();
  assert.equal(checkKeyRateLimit(key, now).allowed, true);
  assert.equal(checkKeyRateLimit(key, now + 1).allowed, true);
  const third = checkKeyRateLimit(key, now + 2);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);

  const fourth = checkKeyRateLimit(key, now + 3);
  assert.equal(fourth.allowed, false);
  assert.match(fourth.reason, /3 requests\/minute/);
  assert.ok(fourth.retryAfterSeconds >= 1 && fourth.retryAfterSeconds <= 60);
});

test("the window slides: capacity returns after a minute", () => {
  __resetForTests();
  const key = { id: "sliding", rpmLimit: 2 };
  const now = Date.now();
  checkKeyRateLimit(key, now);
  checkKeyRateLimit(key, now + 10);
  assert.equal(checkKeyRateLimit(key, now + 20).allowed, false);
  // One minute after the first hit, that slot frees up.
  assert.equal(checkKeyRateLimit(key, now + 60_001).allowed, true);
});

test("limits are per key, not global", () => {
  __resetForTests();
  const a = { id: "a", rpmLimit: 1 };
  const b = { id: "b", rpmLimit: 1 };
  const now = Date.now();
  assert.equal(checkKeyRateLimit(a, now).allowed, true);
  assert.equal(checkKeyRateLimit(a, now).allowed, false);
  assert.equal(checkKeyRateLimit(b, now).allowed, true, "key b has its own budget");
});

test("concurrency cap counts in-flight requests and releases them", () => {
  __resetForTests();
  const key = { id: "conc", concurrencyLimit: 2 };
  assert.equal(checkKeyRateLimit(key).allowed, true);
  const releaseOne = beginKeyRequest(key);
  assert.equal(checkKeyRateLimit(key).allowed, true);
  const releaseTwo = beginKeyRequest(key);

  const blocked = checkKeyRateLimit(key);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /Concurrent request limit/);

  releaseOne();
  assert.equal(checkKeyRateLimit(key).allowed, true, "a finished request frees a slot");
  releaseTwo();
  releaseTwo(); // double release must not go negative
  assert.equal(getKeyRateState("conc").active, 0);
});

test("the dashboard listing only shows keys with recent traffic", () => {
  __resetForTests();
  checkKeyRateLimit({ id: "busy", rpmLimit: 10 });
  checkKeyRateLimit({ id: "busy", rpmLimit: 10 });
  checkKeyRateLimit({ id: "quiet" }); // no limit → not tracked
  const states = listKeyRateStates();
  assert.equal(states.length, 1);
  assert.deepEqual(states[0], { keyId: "busy", used: 2, active: 0 });
});
