import { NextResponse } from "next/server";
import { getAllKeyGroups, getKeyGroupWithPermissions, createKeyGroup } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

// GET /api/keys/groups - List all key groups (with permissions + member counts)
export async function GET(request) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const groups = await getAllKeyGroups();
    const withPermissions = await Promise.all(groups.map((g) => getKeyGroupWithPermissions(g.id)));
    return NextResponse.json({ groups: withPermissions });
  } catch (error) {
    console.log("Error fetching key groups:", error);
    return NextResponse.json({ error: "Failed to fetch key groups" }, { status: 500 });
  }
}

// POST /api/keys/groups - Create a new key group
export async function POST(request) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const body = await request.json();
    const { name, description } = body || {};
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const group = await createKeyGroup(name, description || "");
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.log("Error creating key group:", error);
    return NextResponse.json({ error: "Failed to create key group" }, { status: 500 });
  }
}
