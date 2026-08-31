import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { updateNovaAgent, deleteNovaAgent, getNovaAgentById } from "@/lib/db/repos/novaRepo.js";

export const dynamic = "force-dynamic";

const TOOL_FLAGS = ["terminal","browser","code","files","web","vision","image_gen","video_gen","tts","transcribe","kanban","mcp","async","worktree","moa","osv","gdrive","homeassistant","x_search","github","cloudflare"];

// Accepts array, comma string or nothing; returns a normalized comma string.
function normalizeTools(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = new Set();
  for (const item of list) {
    const t = String(item).trim().toLowerCase();
    if (TOOL_FLAGS.includes(t)) seen.add(t);
  }
  return [...seen].join(",");
}

// PATCH /api/dashboard/nova/agents/[id] — edit agent
export async function PATCH(request, { params }) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const { id } = await params;
    const existing = await getNovaAgentById(id);
    if (!existing) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const body = await request.json();
    const patch = {};
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.specialty !== undefined) patch.specialty = String(body.specialty).trim();
    if (body.systemPrompt !== undefined) patch.systemPrompt = String(body.systemPrompt).trim();
    if (body.providerId !== undefined) patch.providerId = String(body.providerId).trim();
    if (body.modelId !== undefined) patch.modelId = String(body.modelId).trim();
    if (body.modelName !== undefined) patch.modelName = String(body.modelName).trim();
    if (body.status !== undefined) patch.status = body.status === "inactive" ? "inactive" : "active";
    if (body.color !== undefined) patch.color = body.color;
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.tools !== undefined) patch.tools = normalizeTools(body.tools);

    const agent = await updateNovaAgent(id, patch);
    return NextResponse.json({ agent });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to update agent" }, { status: 500 });
  }
}

// DELETE /api/dashboard/nova/agents/[id]
export async function DELETE(request, { params }) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const { id } = await params;
    const ok = await deleteNovaAgent(id);
    if (!ok) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to delete agent" }, { status: 500 });
  }
}
