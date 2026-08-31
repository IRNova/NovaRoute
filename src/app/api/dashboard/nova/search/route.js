import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { searchNovaMessages } from "@/lib/db/repos/novaRepo.js";

export const dynamic = "force-dynamic";

// GET /api/dashboard/nova/search?q=...&limit=20 — search every stored message.
export async function GET(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ results: [] });
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 50);
    const results = await searchNovaMessages(q, limit);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Search failed" }, { status: 500 });
  }
}
