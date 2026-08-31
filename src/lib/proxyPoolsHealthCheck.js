// Scheduled proxy-pool health tests. Reuses the same probe semantics as the
// dashboard's per-pool test route: standard proxies via testProxyUrl, relay
// types (vercel/cloudflare/deno) via a signed relay GET against httpbin.
// A failed test flips the pool to testStatus="error" AND isActive=false —
// dead nodes stop being routed through automatically.
import { getProxyPools, updateProxyPool } from "@/lib/db/repos/proxyPoolsRepo.js";
import { testProxyUrl } from "@/lib/network/proxyTest.js";

const DEFAULT_INTERVAL_H = 12;
const INITIAL_DELAY_MS = 3 * 60 * 1000;
const TEST_TIMEOUT_MS = Number(process.env.NR_POOLS_TEST_TIMEOUT_MS) || 12_000;

let started = false;
let running = false;

function isNonServerRuntime() {
  if (typeof window !== "undefined") return true;
  const phase = process.env.NEXT_PHASE || "";
  if (phase === "phase-production-build" || phase === "phase-export" || phase === "phase-static") return true;
  return process.env.NEXT_RUNTIME === "edge";
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: `timeout after ${Math.round(ms / 1000)}s` }), ms)),
  ]);
}

async function probeRelay(relayUrl) {
  try {
    const res = await fetch(relayUrl, {
      headers: { "x-relay-target": "https://httpbin.org", "x-relay-path": "/get" },
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e?.message || "relay unreachable" };
  }
}

export async function runProxyPoolsHealthCheck() {
  if (running) return { skipped: true };
  running = true;
  try {
    const pools = await getProxyPools({ isActive: true });
    let passed = 0;
    let failed = 0;
    for (const pool of pools) {
      let result;
      if (["vercel", "cloudflare", "deno"].includes(pool.type)) {
        result = await withTimeout(probeRelay(pool.proxyUrl), TEST_TIMEOUT_MS);
      } else {
        result = await withTimeout(testProxyUrl({ proxyUrl: pool.proxyUrl }), TEST_TIMEOUT_MS);
      }
      const now = new Date().toISOString();
      await updateProxyPool(pool.id, {
        testStatus: result.ok ? "active" : "error",
        lastTestedAt: now,
        lastError: result.ok ? null : result.error || `status ${result.status ?? "?"}`,
        isActive: !!result.ok,
      });
      if (result.ok) passed += 1;
      else failed += 1;
    }
    console.log(`[PoolsHealthCheck] done: ${passed} passed, ${failed} disabled/failed (${pools.length} checked)`);
    if (failed > 0) {
      try {
        const { notifyEvent } = await import("@/lib/notify/events.js");
        await notifyEvent({
          event: "pools.health",
          severity: "warning",
          title: "Proxy pool nodes disabled",
          message: `${failed} of ${pools.length} proxy pools failed the health test and were disabled.`,
          payload: { passed, failed },
        });
      } catch {}
    }
    return { ok: true, passed, failed };
  } catch (e) {
    console.error("[PoolsHealthCheck] run failed:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  } finally {
    running = false;
  }
}

export function startProxyPoolsHealthCheck() {
  if (started || isNonServerRuntime()) return;
  started = true;
  const intervalMs = (Number(process.env.NR_POOLS_TEST_INTERVAL_H) || DEFAULT_INTERVAL_H) * 60 * 60 * 1000;

  const initial = setTimeout(() => {
    runProxyPoolsHealthCheck();
    setInterval(() => runProxyPoolsHealthCheck(), intervalMs);
  }, INITIAL_DELAY_MS);
  if (initial.unref) initial.unref();

  const stop = () => clearTimeout(initial);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
