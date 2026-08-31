import { NextResponse } from "next/server";
import { getUsageHistory, getUsageStats } from "@/lib/usageDb";

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

// GET /api/usage/export?format=csv&period=7d&type=requests|models
// type=requests → one row per request (usageHistory). type=models → aggregated per model.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const type = searchParams.get("type") || "requests";

    let rows;
    if (type === "models") {
      const stats = await getUsageStats(period);
      rows = Object.entries(stats?.byModel || {}).map(([key, e]) => ({
        model: key,
        provider: e.provider || "",
        requests: e.requests || 0,
        promptTokens: e.promptTokens || 0,
        completionTokens: e.completionTokens || 0,
        cachedTokens: e.cachedTokens || 0,
        cost: e.cost || 0,
        lastUsed: e.lastUsed || "",
      }));
      rows.sort((a, b) => b.requests - a.requests);
    } else {
      const days = { "1d": 1, today: 1, "24h": 1, "7d": 7, "30d": 30, "60d": 60 }[period] || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      rows = await getUsageHistory({ startDate });
    }

    const csv = toCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv || "no data", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="novaroute-${type}-${period}-${stamp}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
