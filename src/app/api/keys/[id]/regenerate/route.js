import { NextResponse } from "next/server";
import { getApiKeyById, regenerateApiKey } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

// POST /api/keys/[id]/regenerate - Generate a new key string (old one is invalidated)
export async function POST(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const regenerated = await regenerateApiKey(id);
    return NextResponse.json({
      key: regenerated.key,
      name: regenerated.name,
      id: regenerated.id,
    }, { status: 200 });
  } catch (error) {
    console.log("Error regenerating key:", error);
    return NextResponse.json({ error: "Failed to regenerate key" }, { status: 500 });
  }
}
