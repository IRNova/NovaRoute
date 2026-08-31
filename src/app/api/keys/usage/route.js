import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { getAdapterSync } from "@/lib/db/driver";

export const dynamic = "force-dynamic";

// GET /api/keys/usage - Get usage stats per API key
export async function GET(request) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const db = getAdapterSync();
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Get usage grouped by apiKey
    const rows = db.all(`
      SELECT 
        apiKey,
        COUNT(*) as requestCount,
        COALESCE(SUM(cost), 0) as totalCost,
        COALESCE(SUM(
          COALESCE(json_extract(tokens, '$.prompt_tokens'), 0) + 
          COALESCE(json_extract(tokens, '$.completion_tokens'), 0)
        ), 0) as totalTokens
      FROM usageHistory 
      WHERE apiKey IS NOT NULL AND apiKey != ''
      GROUP BY apiKey
    `);

    // Also get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const todayRows = db.all(`
      SELECT 
        apiKey,
        COUNT(*) as requestCount,
        COALESCE(SUM(cost), 0) as totalCost,
        COALESCE(SUM(
          COALESCE(json_extract(tokens, '$.prompt_tokens'), 0) + 
          COALESCE(json_extract(tokens, '$.completion_tokens'), 0)
        ), 0) as totalTokens
      FROM usageHistory 
      WHERE apiKey IS NOT NULL AND apiKey != '' AND timestamp >= ?
      GROUP BY apiKey
    `, [todayStr]);

    // usageHistory.apiKey stores the RAW key value (as sent by clients), but the
    // dashboard looks stats up by key id — map raw -> id via the apiKeys table.
    const keyRows = db.all(`SELECT id, key FROM apiKeys`);
    const rawKeyToId = {};
    for (const kr of keyRows) {
      if (kr?.key && kr?.id) rawKeyToId[kr.key] = kr.id;
    }

    // Build usage map keyed by key id (falls back to the stored value itself)
    const usage = {};
    const putUsage = (storedValue, bucket, stats) => {
      const keyId = rawKeyToId[storedValue] || storedValue;
      if (!usage[keyId]) {
        usage[keyId] = {
          allTime: { requests: 0, cost: 0, tokens: 0 },
          today: { requests: 0, cost: 0, tokens: 0 },
        };
      }
      usage[keyId][bucket] = stats;
    };

    for (const row of rows) {
      putUsage(row.apiKey, "allTime", {
        requests: row.requestCount,
        cost: row.totalCost,
        tokens: row.totalTokens,
      });
    }

    for (const row of todayRows) {
      putUsage(row.apiKey, "today", {
        requests: row.requestCount,
        cost: row.totalCost,
        tokens: row.totalTokens,
      });
    }

    return NextResponse.json({ usage });
  } catch (error) {
    console.log("Error fetching key usage:", error);
    return NextResponse.json({ error: "Failed to fetch key usage" }, { status: 500 });
  }
}
