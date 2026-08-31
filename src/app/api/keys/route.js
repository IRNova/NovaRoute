import { NextResponse } from "next/server";
import { getApiKeys, createApiKey, maskStoredApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

export const dynamic = "force-dynamic";

// GET /api/keys - List API keys (key always masked unless reveal is requested)
export async function GET(request) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const keys = await getApiKeys();
    const masked = keys.map((k) => ({
      ...k,
      key: maskStoredApiKey(k.key),
      rawKey: undefined,
    }));
    return NextResponse.json({ keys: masked });
  } catch (error) {
    console.log("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

// POST /api/keys - Create new API key
export async function POST(request) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const body = await request.json();
    const {
      name,
      scopes,
      noLog,
      allowUsageCommand,
      usageLimitEnabled,
      dailyUsageLimitUsd,
      weeklyUsageLimitUsd,
      allowedModels,
      blockedModels,
      modelAccessMode,
      rpmLimit,
      concurrencyLimit,
      expiresAt,
    } = body || {};

    let expiresAtIso = null;
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "expiresAt must be a valid date" }, { status: 400 });
      }
      expiresAtIso = d.toISOString();
    }

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (scopes !== undefined && (!Array.isArray(scopes) || scopes.some((s) => typeof s !== "string"))) {
      return NextResponse.json({ error: "scopes must be an array of strings" }, { status: 400 });
    }

    // Always get machineId from server
    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey(name, machineId, scopes, {
      noLog,
      allowUsageCommand,
      usageLimitEnabled,
      dailyUsageLimitUsd,
      weeklyUsageLimitUsd,
      allowedModels,
      blockedModels,
      modelAccessMode,
      rpmLimit,
      concurrencyLimit,
      expiresAt: expiresAtIso,
    });

    // Full key returned once at creation time (the only time it's ever revealed)
    return NextResponse.json({
      key: apiKey.key,
      name: apiKey.name,
      id: apiKey.id,
      machineId: apiKey.machineId,
    }, { status: 201 });
  } catch (error) {
    console.log("Error creating key:", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
