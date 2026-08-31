import { NextResponse } from "next/server";
import { listAdminActions, clearAdminActions } from "@/lib/security/adminAudit.js";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

export const dynamic = "force-dynamic";

// GET /api/security/audit?limit=100&sensitive=1 — administrative action trail.
export async function GET(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;

  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") || "100", 10);
  const sensitiveOnly = searchParams.get("sensitive") === "1";
  const entries = await listAdminActions({
    limit: Number.isFinite(limit) ? limit : 100,
    sensitiveOnly,
  });
  return NextResponse.json({ entries, count: entries.length });
}

// DELETE /api/security/audit — clear the trail (itself audited by the guard).
export async function DELETE(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  const cleared = await clearAdminActions();
  return NextResponse.json({ cleared });
}
