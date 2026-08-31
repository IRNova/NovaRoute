import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { getNovaAgents, createNovaAgent } from "@/lib/db/repos/novaRepo.js";

export const dynamic = "force-dynamic";

const ROLES = ["ceo", "supervisor", "employee"];
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

// GET /api/dashboard/nova/agents — team roster
export async function GET(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const agents = await getNovaAgents();
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to load agents" }, { status: 500 });
  }
}

// POST /api/dashboard/nova/agents — add agent
export async function POST(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!body.modelId) {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }
    const role = ROLES.includes(body.role) ? body.role : "employee";

    const agent = await createNovaAgent({
      name,
      role,
      specialty: String(body.specialty || "").trim(),
      systemPrompt: String(body.systemPrompt || "").trim(),
      providerId: String(body.providerId || "").trim(),
      modelId: String(body.modelId).trim(),
      modelName: String(body.modelName || body.modelId).trim(),
      status: body.status === "inactive" ? "inactive" : "active",
      color: body.color || null,
      icon: body.icon || null,
      tools: normalizeTools(body.tools),
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to create agent" }, { status: 500 });
  }
}
