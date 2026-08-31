import { NextResponse } from "next/server";
import { getApiKeyById } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { getKeyRateState } from "@/lib/security/keyRateLimiter.js";
import {
  getApiKeyUsageLimitStatus,
  getDailyWindowStartIso,
  getDailyResetAtIso,
  getWeeklyWindowStartIso,
} from "@/lib/apiKeyPolicy";

// GET /api/keys/[id]/usage-limits - Current USD spend vs configured limits
export async function GET(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const now = Date.now();
    const dailyWindowStartIso = getDailyWindowStartIso(now);
    const weeklyWindowStartIso = getWeeklyWindowStartIso(now);

    let status = {
      enabled: key.usageLimitEnabled === true,
      dailyLimitUsd: key.dailyUsageLimitUsd ?? null,
      weeklyLimitUsd: key.weeklyUsageLimitUsd ?? null,
      dailySpentUsd: 0,
      weeklySpentUsd: 0,
      dailyWindowStartIso,
      dailyResetAtIso: getDailyResetAtIso(now),
      weeklyWindowStartIso,
      weeklyResetAtIso: null,
      dailyExceeded: false,
      weeklyExceeded: false,
    };
    try {
      status = await getApiKeyUsageLimitStatus(key);
    } catch {
      // keep the basic shape above if the spend query fails
    }

    // Request-rate limits live alongside spend limits: same page, same call.
    const rate = getKeyRateState(key.id);
    return NextResponse.json({
      keyId: key.id,
      usage: status,
      rate: {
        rpmLimit: key.rpmLimit ?? null,
        concurrencyLimit: key.concurrencyLimit ?? null,
        usedThisMinute: rate.used,
        activeRequests: rate.active,
      },
    });
  } catch (error) {
    console.log("Error fetching key usage limits:", error);
    return NextResponse.json({ error: "Failed to fetch usage limits" }, { status: 500 });
  }
}

// PATCH /api/keys/[id]/usage-limits - Set daily/weekly USD limits
export async function PATCH(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const body = await request.json();
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const { updateApiKeyPermissions } = await import("@/lib/localDb");
    const update = {};
    if (body.usageLimitEnabled !== undefined) update.usageLimitEnabled = !!body.usageLimitEnabled;
    if (body.dailyUsageLimitUsd !== undefined) update.dailyUsageLimitUsd = body.dailyUsageLimitUsd ?? null;
    if (body.weeklyUsageLimitUsd !== undefined) update.weeklyUsageLimitUsd = body.weeklyUsageLimitUsd ?? null;
    if (body.rpmLimit !== undefined) {
      const n = Number(body.rpmLimit);
      update.rpmLimit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    }
    if (body.concurrencyLimit !== undefined) {
      const n = Number(body.concurrencyLimit);
      update.concurrencyLimit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    }

    const updated = await updateApiKeyPermissions(id, update);
    return NextResponse.json({ key: updated });
  } catch (error) {
    console.log("Error updating usage limits:", error);
    return NextResponse.json({ error: "Failed to update usage limits" }, { status: 500 });
  }
}
