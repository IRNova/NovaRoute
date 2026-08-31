import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";
import { AI_MODELS } from "@/shared/constants/config";

export const dynamic = "force-dynamic";

// GET /api/public-status — safe, non-sensitive summary for the public
// /status page. Deliberately exposes NO keys, providers names, or usage data.
export async function GET() {
  try {
    let activeConnections = null;
    try {
      const conns = await getProviderConnections();
      activeConnections = conns.filter((c) => c.isActive !== false).length;
    } catch {}
    return NextResponse.json({
      ok: true,
      uptimeSeconds: Math.floor(process.uptime()),
      activeConnections,
      modelsAvailable: Array.isArray(AI_MODELS) ? AI_MODELS.length : null,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, timestamp: new Date().toISOString() });
  }
}
