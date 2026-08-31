import { NextResponse } from "next/server";
import { deleteApiKey, getApiKeyById, updateApiKey, updateApiKeyPermissions, maskStoredApiKey } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

// GET /api/keys/[id] - Get single key (key always masked)
export async function GET(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json({ key: { ...key, key: maskStoredApiKey(key.key), rawKey: undefined } });
  } catch (error) {
    console.log("Error fetching key:", error);
    return NextResponse.json({ error: "Failed to fetch key" }, { status: 500 });
  }
}

// PUT /api/keys/[id] - Update key (name / isActive)
export async function PUT(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const body = await request.json();
    const { isActive, name } = body;

    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (name !== undefined) updateData.name = name;

    const updated = await updateApiKey(id, updateData);

    return NextResponse.json({ key: { ...updated, key: maskStoredApiKey(updated.key) } });
  } catch (error) {
    console.log("Error updating key:", error);
    return NextResponse.json({ error: "Failed to update key" }, { status: 500 });
  }
}

// PATCH /api/keys/[id] - Update key permissions (scopes, limits, model access, flags)
export async function PATCH(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const body = await request.json();

    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const update = {};
    if (body.scopes !== undefined) {
      if (!Array.isArray(body.scopes) || body.scopes.some((s) => typeof s !== "string")) {
        return NextResponse.json({ error: "scopes must be an array of strings" }, { status: 400 });
      }
      update.scopes = body.scopes;
    }
    if (body.noLog !== undefined) update.noLog = !!body.noLog;
    if (body.allowUsageCommand !== undefined) update.allowUsageCommand = !!body.allowUsageCommand;
    if (body.rpmLimit !== undefined) update.rpmLimit = body.rpmLimit === null || body.rpmLimit === "" ? null : Number(body.rpmLimit);
    if (body.concurrencyLimit !== undefined) update.concurrencyLimit = body.concurrencyLimit === null || body.concurrencyLimit === "" ? null : Number(body.concurrencyLimit);
    if (body.usageLimitEnabled !== undefined) update.usageLimitEnabled = !!body.usageLimitEnabled;
    if (body.dailyUsageLimitUsd !== undefined) update.dailyUsageLimitUsd = body.dailyUsageLimitUsd ?? null;
    if (body.weeklyUsageLimitUsd !== undefined) update.weeklyUsageLimitUsd = body.weeklyUsageLimitUsd ?? null;
    if (body.allowedModels !== undefined) {
      if (!Array.isArray(body.allowedModels) || body.allowedModels.some((s) => typeof s !== "string")) {
        return NextResponse.json({ error: "allowedModels must be an array of strings" }, { status: 400 });
      }
      update.allowedModels = body.allowedModels;
    }
    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null || body.expiresAt === "") {
        update.expiresAt = null;
      } else {
        const d = new Date(body.expiresAt);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "expiresAt must be a valid date" }, { status: 400 });
        }
        update.expiresAt = d.toISOString();
      }
    }
    if (body.blockedModels !== undefined) {
      if (!Array.isArray(body.blockedModels) || body.blockedModels.some((s) => typeof s !== "string")) {
        return NextResponse.json({ error: "blockedModels must be an array of strings" }, { status: 400 });
      }
      update.blockedModels = body.blockedModels;
    }
    if (body.modelAccessMode !== undefined) {
      if (!["all", "restricted"].includes(body.modelAccessMode)) {
        return NextResponse.json({ error: "modelAccessMode must be 'all' or 'restricted'" }, { status: 400 });
      }
      update.modelAccessMode = body.modelAccessMode;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await updateApiKeyPermissions(id, update);
    return NextResponse.json({ key: { ...updated, key: maskStoredApiKey(existing.key) } });
  } catch (error) {
    console.log("Error updating key permissions:", error);
    return NextResponse.json({ error: "Failed to update key permissions" }, { status: 500 });
  }
}

// DELETE /api/keys/[id] - Delete API key
export async function DELETE(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;

    const deleted = await deleteApiKey(id);
    if (!deleted) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Key deleted successfully" });
  } catch (error) {
    console.log("Error deleting key:", error);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
