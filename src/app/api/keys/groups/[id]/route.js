import { NextResponse } from "next/server";
import {
  getKeyGroupWithPermissions,
  updateKeyGroup,
  deleteKeyGroup,
  getGroupMembers,
  addGroupPermission,
  removeGroupPermission,
  clearGroupPermissions,
  addKeyToGroup,
  removeKeyFromGroup,
} from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

function invalid(modelPattern, accessType) {
  return (
    typeof modelPattern !== "string" ||
    !modelPattern ||
    !["allow", "deny"].includes(accessType)
  );
}

// GET /api/keys/groups/[id] - Get a single group (with permissions + members)
export async function GET(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const group = await getKeyGroupWithPermissions(id);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const members = await getGroupMembers(id);
    return NextResponse.json({ group, members });
  } catch (error) {
    console.log("Error fetching key group:", error);
    return NextResponse.json({ error: "Failed to fetch key group" }, { status: 500 });
  }
}

// PATCH /api/keys/groups/[id] - Update group (name / description / isActive)
export async function PATCH(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const body = await request.json();
    const updated = await updateKeyGroup(id, {
      name: body.name,
      description: body.description,
      isActive: body.isActive,
    });
    if (!updated) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    return NextResponse.json({ group: updated });
  } catch (error) {
    console.log("Error updating key group:", error);
    return NextResponse.json({ error: "Failed to update key group" }, { status: 500 });
  }
}

// DELETE /api/keys/groups/[id] - Delete a group (and its permissions/memberships)
export async function DELETE(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const deleted = await deleteKeyGroup(id);
    if (!deleted) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.log("Error deleting key group:", error);
    return NextResponse.json({ error: "Failed to delete key group" }, { status: 500 });
  }
}

// POST /api/keys/groups/[id]/permissions - Add a model allow/deny rule to the group
export async function POSTPermission(request, { params }) {
  return handlePermission(request, params);
}

export async function POST(request, { params }) {
  // Route: /api/keys/groups/[id] with body {action:"add-permission"|"remove-permission"|"clear-permissions"|"add-key"|"remove-key"}
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const body = await request.json() || {};
    const action = body.action;

    if (action === "add-permission") {
      const { modelPattern, accessType, provider } = body;
      if (invalid(modelPattern, accessType)) {
        return NextResponse.json(
          { error: "modelPattern (string) and accessType ('allow'|'deny') are required" },
          { status: 400 }
        );
      }
      const permission = await addGroupPermission(id, modelPattern, accessType, provider || null);
      return NextResponse.json({ permission }, { status: 201 });
    }

    if (action === "remove-permission") {
      const { permissionId } = body;
      if (!permissionId) {
        return NextResponse.json({ error: "permissionId is required" }, { status: 400 });
      }
      const removed = await removeGroupPermission(permissionId);
      if (!removed) {
        return NextResponse.json({ error: "Permission not found" }, { status: 404 });
      }
      return NextResponse.json({ message: "Permission removed" });
    }

    if (action === "clear-permissions") {
      await clearGroupPermissions(id);
      return NextResponse.json({ message: "Permissions cleared" });
    }

    if (action === "add-key") {
      const { keyId } = body;
      if (!keyId) {
        return NextResponse.json({ error: "keyId is required" }, { status: 400 });
      }
      const added = await addKeyToGroup(keyId, id);
      if (!added) {
        return NextResponse.json({ error: "Failed to add key to group" }, { status: 400 });
      }
      return NextResponse.json({ message: "Key added to group" }, { status: 201 });
    }

    if (action === "remove-key") {
      const { keyId } = body;
      if (!keyId) {
        return NextResponse.json({ error: "keyId is required" }, { status: 400 });
      }
      const removed = await removeKeyFromGroup(keyId, id);
      if (!removed) {
        return NextResponse.json({ error: "Key is not in this group" }, { status: 404 });
      }
      return NextResponse.json({ message: "Key removed from group" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.log("Error in key group action:", error);
    return NextResponse.json({ error: "Failed to perform key group action" }, { status: 500 });
  }
}
