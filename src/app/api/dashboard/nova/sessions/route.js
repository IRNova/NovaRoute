import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { getNovaSessions, createNovaSession } from "@/lib/db/repos/novaRepo.js";

export const dynamic = "force-dynamic";

// GET /api/dashboard/nova/sessions — list sessions
export async function GET(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const sessions = await getNovaSessions();
    // Enrich sessions with agentId from title
    const enriched = sessions.map((s) => ({
      ...s,
      agentId: s.agentId || (s.title?.startsWith("chat:") ? s.title.slice(5) : null),
    }));
    return NextResponse.json({ sessions: enriched });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to load sessions" }, { status: 500 });
  }
}

// POST /api/dashboard/nova/sessions — create session
export async function POST(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const body = await request.json().catch(() => ({}));
    const agentId = String(body.agentId || "").trim();
    const title = String(body.title || "").trim() || (agentId ? `chat:${agentId}` : "");
    const session = await createNovaSession(title);
    // Store agentId in session title for later lookup
    if (agentId && session) {
      session.agentId = agentId;
    }
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to create session" }, { status: 500 });
  }
}
