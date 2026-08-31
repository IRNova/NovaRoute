import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { getNovaStats } from "@/lib/db/repos/novaRepo.js";

export const dynamic = "force-dynamic";

// GET /api/dashboard/nova/stats — supervision room: per-agent productivity
export async function GET(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const stats = await getNovaStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to load stats" }, { status: 500 });
  }
}
