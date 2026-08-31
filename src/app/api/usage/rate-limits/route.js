import { NextResponse } from "next/server";
import { getApiKeys } from "@/lib/localDb";
import { getKeyRateState } from "@/lib/security/keyRateLimiter.js";

export const dynamic = "force-dynamic";

// GET /api/usage/rate-limits — live per-key request limits and how much of the
// current minute each key has used. Keys with no limit configured are listed
// too, so the page shows traffic even before anyone sets a cap.
export async function GET() {
  try {
    const keys = await getApiKeys();
    const limits = keys
      .filter((k) => k.isActive !== false)
      .map((k) => {
        const state = getKeyRateState(k.id);
        return {
          keyId: k.id,
          name: k.name || "unnamed key",
          rpm: k.rpmLimit ?? 0,
          concurrencyLimit: k.concurrencyLimit ?? 0,
          current: state.used,
          active: state.active,
          // Field names the existing chart reads.
          provider: k.name || "unnamed key",
          model: k.rpmLimit ? `${k.rpmLimit} rpm` : "no limit",
        };
      })
      .filter((row) => row.rpm > 0 || row.current > 0 || row.active > 0)
      .sort((a, b) => b.current - a.current);

    return NextResponse.json({ limits, windowSeconds: 60 });
  } catch (error) {
    return NextResponse.json({ limits: [], error: error.message }, { status: 200 });
  }
}
