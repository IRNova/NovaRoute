import { NextResponse } from "next/server";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";
import { getProxyPools } from "@/lib/db/repos/proxyPoolsRepo.js";
import { BACKUPS_DIR } from "@/lib/db/paths.js";

export const dynamic = "force-dynamic";

function latestBackupAgeHours() {
  try {
    const entries = fs.readdirSync(BACKUPS_DIR).filter((n) => n.startsWith("daily-"));
    let latest = 0;
    for (const name of entries) {
      const st = fs.statSync(path.join(BACKUPS_DIR, name));
      latest = Math.max(latest, st.mtimeMs);
    }
    if (!latest) return null;
    return Math.round(((Date.now() - latest) / 3600000) * 10) / 10;
  } catch {
    return null;
  }
}

// GET /api/system/health-report — one-click "is everything okay?" summary
// for the dashboard button. Read-only; no secrets.
export async function GET() {
  const checks = [];
  const push = (name, status, detail) => checks.push({ name, status, detail });

  // Service basics
  push("Service", "healthy", `uptime ${Math.floor(process.uptime() / 60)}m`);

  // Memory pressure
  const heapMB = Math.round(process.memoryUsage().heapUsed / 1048576);
  push("Memory", heapMB < 500 ? "healthy" : "degraded", `heap ${heapMB} MB`);

  // Failing providers
  let failing = [];
  try {
    const conns = await getProviderConnections();
    failing = conns.filter(
      (c) => c.isActive !== false && (c.testStatus === "error" || c.testStatus === "unavailable")
    );
    push("Providers", failing.length ? "degraded" : "healthy",
      failing.length ? `${failing.length} failing: ${failing.slice(0, 3).map((c) => c.provider).join(", ")}` : `${conns.filter((c) => c.isActive !== false).length} active`);
  } catch (e) {
    push("Providers", "unknown", e.message);
  }

  // Proxy pools
  try {
    const pools = await getProxyPools({ isActive: true });
    const down = pools.filter((p) => p.testStatus === "error");
    push("Proxy pools", down.length ? "degraded" : pools.length ? "healthy" : "none", down.length ? `${down.length} of ${pools.length} failing` : `${pools.length} active`);
  } catch {}

  // Backup freshness
  const ageH = latestBackupAgeHours();
  if (ageH === null) push("Backups", "warning", "no automatic backups found");
  else push("Backups", ageH <= 26 ? "healthy" : "warning", `latest snapshot ${ageH}h ago`);

  // Observability hint (latency percentiles depend on it)
  push("Request logs", process.env.ENABLE_REQUEST_LOGS === "true" || process.env.OBSERVABILITY_ENABLED === "true" ? "healthy" : "info",
    process.env.ENABLE_REQUEST_LOGS === "true" || process.env.OBSERVABILITY_ENABLED === "true" ? "capture enabled" : "disabled — enable ENABLE_REQUEST_LOGS for analytics");

  const worst = checks.some((c) => c.status === "degraded") ? "degraded" : "healthy";

  return NextResponse.json({
    status: worst,
    systemFreeMemMB: Math.round(os.freemem() / 1048576),
    checks,
    generatedAt: new Date().toISOString(),
  });
}
