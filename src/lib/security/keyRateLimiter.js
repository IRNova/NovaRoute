// Per-key request rate limiting for the gateway.
//
// A key can carry a requests-per-minute cap (`rpmLimit`) and a concurrent
// request cap (`concurrencyLimit`). Both are enforced in-process with a
// sliding window — state is intentionally not persisted: a restart clearing
// the window is the right trade for keeping the hot path free of DB writes,
// and spend limits (which do survive restarts) are the durable control.
//
// Every function is safe to call with a key that has no limits configured.

const WINDOW_MS = 60_000;

// keyId → { hits: number[] (timestamps), active: number }
const buckets = new Map();
// Bound the map so a key farm cannot grow it without limit.
const MAX_TRACKED_KEYS = 5_000;

function bucketFor(keyId) {
  let bucket = buckets.get(keyId);
  if (!bucket) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      // Drop the coldest bucket rather than refusing to track a new key.
      const oldest = [...buckets.entries()].sort(
        (a, b) => (a[1].hits[a[1].hits.length - 1] || 0) - (b[1].hits[b[1].hits.length - 1] || 0)
      )[0];
      if (oldest) buckets.delete(oldest[0]);
    }
    bucket = { hits: [], active: 0 };
    buckets.set(keyId, bucket);
  }
  return bucket;
}

function prune(bucket, now) {
  const cutoff = now - WINDOW_MS;
  while (bucket.hits.length && bucket.hits[0] < cutoff) bucket.hits.shift();
}

function limitOf(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Record a request against a key and report whether it is over its limits.
 *
 * @param {object} apiKeyInfo key metadata row (needs id, rpmLimit, concurrencyLimit)
 * @returns {{ allowed: boolean, reason?: string, retryAfterSeconds?: number,
 *             limit?: number, remaining: number, used: number }}
 */
export function checkKeyRateLimit(apiKeyInfo, nowMs = Date.now()) {
  const rpm = limitOf(apiKeyInfo?.rpmLimit);
  const concurrency = limitOf(apiKeyInfo?.concurrencyLimit);
  const keyId = apiKeyInfo?.id;
  if (!keyId || (!rpm && !concurrency)) {
    return { allowed: true, remaining: Infinity, used: 0 };
  }

  const bucket = bucketFor(keyId);
  prune(bucket, nowMs);

  if (concurrency && bucket.active >= concurrency) {
    return {
      allowed: false,
      reason: `Concurrent request limit reached for this API key (${concurrency} in flight)`,
      retryAfterSeconds: 1,
      limit: concurrency,
      remaining: 0,
      used: bucket.active,
    };
  }

  if (rpm && bucket.hits.length >= rpm) {
    const oldest = bucket.hits[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - nowMs) / 1000));
    return {
      allowed: false,
      reason: `Rate limit reached for this API key (${rpm} requests/minute)`,
      retryAfterSeconds,
      limit: rpm,
      remaining: 0,
      used: bucket.hits.length,
    };
  }

  bucket.hits.push(nowMs);
  return {
    allowed: true,
    limit: rpm || undefined,
    remaining: rpm ? rpm - bucket.hits.length : Infinity,
    used: bucket.hits.length,
  };
}

/** Mark a request as in flight (call once a request is accepted). */
export function beginKeyRequest(apiKeyInfo) {
  const keyId = apiKeyInfo?.id;
  if (!keyId || !limitOf(apiKeyInfo?.concurrencyLimit)) return () => {};
  const bucket = bucketFor(keyId);
  bucket.active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    bucket.active = Math.max(0, bucket.active - 1);
  };
}

/** Current window state for a key, for the dashboard. Never mutates. */
export function getKeyRateState(keyId, nowMs = Date.now()) {
  const bucket = buckets.get(keyId);
  if (!bucket) return { used: 0, active: 0 };
  prune(bucket, nowMs);
  return { used: bucket.hits.length, active: bucket.active };
}

/** All tracked keys, newest activity first. */
export function listKeyRateStates(nowMs = Date.now()) {
  const out = [];
  for (const [keyId, bucket] of buckets.entries()) {
    prune(bucket, nowMs);
    if (!bucket.hits.length && !bucket.active) continue;
    out.push({ keyId, used: bucket.hits.length, active: bucket.active });
  }
  return out.sort((a, b) => b.used - a.used);
}

export function __resetForTests() {
  buckets.clear();
}
