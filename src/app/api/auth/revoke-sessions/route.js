import { NextResponse } from "next/server";
import { revokeAllSessions } from "@/lib/auth/dashboardSession";

// POST /api/auth/revoke-sessions — invalidate every dashboard session on all
// devices by rotating the JWT signing epoch. The caller's own cookie dies too.
export async function POST() {
  try {
    await revokeAllSessions();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
