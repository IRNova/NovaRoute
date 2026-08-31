import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { getNovaSessionTranscript, deleteNovaSession } from "@/lib/db/repos/novaRepo.js";

export const dynamic = "force-dynamic";

// GET /api/dashboard/nova/sessions/[id] — full transcript (messages + tasks)
// ?format=md → Markdown export download; ?format=json → default transcript.
export async function GET(request, { params }) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const { id } = await params;
    const format = new URL(request.url).searchParams.get("format");
    const transcript = await getNovaSessionTranscript(id);
    if (!transcript) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (format === "md") {
      const t = transcript.session?.title || id;
      const lines = [`# NovaRoute session — ${t}`, "", `- Session ID: ${id}`, `- Created: ${transcript.session?.createdAt || "—"}`, ""];
      for (const m of transcript.messages || []) {
        const who = m.role === "user" ? "🧑 User" : `🤖 ${m.agentName || m.agentId || "Agent"}${m.agentRole ? ` (${m.agentRole})` : ""}`;
        lines.push(`## ${who} — ${m.createdAt || ""} ${m.type && m.type !== "message" ? `[${m.type}]` : ""}`.trimEnd());
        lines.push("", String(m.content ?? ""), "");
      }
      if ((transcript.tasks || []).length) {
        lines.push("## Tasks", "");
        for (const task of transcript.tasks) {
          lines.push(`- **${task.fromAgentName || task.fromAgentId || "?"} → ${task.toAgentName || task.toAgentId || "?"}**: ${task.instruction || ""} _[${task.status || "pending"}]_`);
        }
        lines.push("");
      }
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="novaroute-session-${id}.md"`,
        },
      });
    }

    return NextResponse.json(transcript);
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to load session" }, { status: 500 });
  }
}

// DELETE /api/dashboard/nova/sessions/[id]
export async function DELETE(request, { params }) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const { id } = await params;
    const ok = await deleteNovaSession(id);
    if (!ok) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to delete session" }, { status: 500 });
  }
}
