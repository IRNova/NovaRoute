import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { listApprovals, resolveApproval } from "@/lib/nova/tools.js";

export const dynamic = "force-dynamic";

// GET /api/dashboard/nova/approvals — pending + recent terminal approvals
export async function GET(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    return NextResponse.json(await listApprovals());
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to load approvals" }, { status: 500 });
  }
}

// POST — resolve a pending approval: { id, action: "approve" | "deny" }
export async function POST(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  let body = {};
  try {
    body = await request.json();
  } catch {}
  const id = String(body.id || "").trim();
  const action = String(body.action || "").trim();
  if (!id || !["approve", "deny"].includes(action)) {
    return NextResponse.json({ error: "id and action (approve|deny) are required" }, { status: 400 });
  }
  try {
    const resolved = await resolveApproval(id, action === "approve", "dashboard");
    if (!resolved) {
      return NextResponse.json({ error: "Approval not found (maybe already resolved)" }, { status: 404 });
    }
    return NextResponse.json(await listApprovals());
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to resolve approval" }, { status: 500 });
  }
}
