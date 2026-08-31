// Scheduled provider health checks: periodically re-tests every active
// connection so testStatus / dashboard badges stay fresh without manual runs.
//
// Uses the same battle-tested probe as the dashboard (testSingleConnection),
// which already persists testStatus + refreshes OAuth tokens itself.
// Each probe gets a hard timeout via Promise.race because the underlying
// fetches have no AbortController of their own.
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";

const DEFAULT_INTERVAL_H = 6;
const INITIAL_DELAY_MS = 90 * 1000;
const PER_CONNECTION_TIMEOUT_MS = Number(process.env.NR_PROVIDERS_TEST_TIMEOUT_MS) || 45_000;

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
    new Promise((resolve) => setTimeout(() => resolve({ valid: false, error: `timeout after ${Math.round(ms / 1000)}s` }), ms)),
  ]);
}

export async function runProviderHealthCheck({ maxConnections = 30 } = {}) {
  if (running) return { skipped: true, reason: "already-running" };
  running = true;
  try {
    const connections = await getProviderConnections({ isActive: true });
    const targets = connections.slice(0, maxConnections);
    let passed = 0;
    let failed = 0;
    for (const conn of targets) {
      try {
        const result = await withTimeout(
          import("@/app/api/providers/[id]/test/testUtils.js").then((m) =>
            m.testSingleConnection(conn.id)
          ),
          PER_CONNECTION_TIMEOUT_MS
        );
        if (result?.valid) passed += 1;
        else failed += 1;
      } catch (e) {
        failed += 1;
        console.warn(`[ProvidersHealthCheck] ${conn.provider}/${conn.id}: ${e?.message || e}`);
      }
    }
    console.log(`[ProvidersHealthCheck] done: ${passed} passed, ${failed} failed (${targets.length} checked)`);
    if (failed > 0) {
      try {
        const { notifyEvent } = await import("@/lib/notify/events.js");
        await notifyEvent({
          event: "providers.health",
          severity: "warning",
          title: "Provider health check found failures",
          message: `${failed} of ${targets.length} connections are failing. Open Dashboard → Providers for details.`,
          payload: { passed, failed },
        });
      } catch {}
    }
    return { ok: true, passed, failed, total: targets.length };
  } catch (e) {
    console.error("[ProvidersHealthCheck] run failed:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  } finally {
    running = false;
  }
}

export function startProviderHealthCheck() {
  if (started || isNonServerRuntime()) return;
  started = true;
  const intervalMs = (Number(process.env.NR_PROVIDERS_HEALTH_INTERVAL_H) || DEFAULT_INTERVAL_H) * 60 * 60 * 1000;

  const initial = setTimeout(() => {
    runProviderHealthCheck();
    setInterval(() => runProviderHealthCheck(), intervalMs);
  }, INITIAL_DELAY_MS);
  if (initial.unref) initial.unref();

  const stop = () => clearTimeout(initial);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
