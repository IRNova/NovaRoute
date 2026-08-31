import { NextResponse } from "next/server";
import { getUsageStats, getMonthCost } from "@/lib/usageDb";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

// Cost-focused slice of usage stats (reuses the same aggregation as /api/usage/stats
// but returns only what the Costs dashboard renders, plus the calendar-month total
// for budget progress).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const stats = await getUsageStats(period);
    const month = await getMonthCost();

    const byAccount = Object.entries(stats.byAccount || {})
      .map(([key, a]) => ({
        account: a.accountName || key,
        id: a.connectionId,
        provider: a.provider || "",
        requests: a.requests || 0,
        tokens: (a.promptTokens || 0) + (a.completionTokens || 0),
        cost: a.cost || 0,
      }))
      .sort((a, b) => b.cost - a.cost);

    const byProvider = Object.entries(stats.byProvider || {})
      .map(([provider, p]) => ({
        provider,
        requests: p.requests || 0,
        tokens: (p.promptTokens || 0) + (p.completionTokens || 0),
        cost: p.cost || 0,
      }))
      .sort((a, b) => b.cost - a.cost);

    const byModel = Object.entries(stats.byModel || {})
      .map(([key, m]) => ({
        model: m.rawModel || key.split(" (")[0],
        provider: m.provider || "",
        requests: m.requests || 0,
        tokens: (m.promptTokens || 0) + (m.completionTokens || 0),
        cost: m.cost || 0,
        lastUsed: m.lastUsed || "",
      }))
      .sort((a, b) => b.cost - a.cost);

    return NextResponse.json({
      period,
      totalCost: stats.totalCost || 0,
      totalRequests: stats.totalRequests || 0,
      totalTokens: (stats.totalPromptTokens || 0) + (stats.totalCompletionTokens || 0),
      avgCostPerRequest: stats.totalRequests ? (stats.totalCost || 0) / stats.totalRequests : 0,
      byProvider,
      byModel,
      byAccount,
      monthCost: month.cost,
      monthRequests: month.requests,
    });
  } catch (error) {
    console.error("[API] Failed to get cost summary:", error);
    return NextResponse.json({ error: "Failed to fetch cost summary" }, { status: 500 });
  }
}
