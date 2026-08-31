import { NextResponse } from "next/server";
import { getRequestDetails } from "@/lib/usageDb";

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

// GET /api/usage/latency?period=7d — TTFT + total-latency percentiles
// computed from the requestDetails ledger (requires observability enabled).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const days = { "1d": 1, today: 1, "24h": 1, "7d": 7, "30d": 30 }[period] || 7;
    const startDate = new Date(Date.now() - days * 86400000).toISOString();

    // Collect up to 1000 recent samples.
    const totals = [];
    const ttfts = [];
    const byModel = new Map();
    for (let page = 1; page <= 10; page++) {
      const result = await getRequestDetails({ page, pageSize: 100, startDate });
      const rows = result?.details || [];
      for (const r of rows) {
        const lat = r.latency || {};
        const total = Number(lat.total);
        const ttft = Number(lat.ttft);
        if (!Number.isFinite(total)) continue;
        totals.push(total);
        if (Number.isFinite(ttft)) ttfts.push(ttft);
        const key = `${r.provider || "?"}/${r.model || "?"}`;
        if (!byModel.has(key)) byModel.set(key, []);
        byModel.get(key).push(total);
      }
      if (!result?.pagination?.hasNext) break;
    }

    const summarize = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        samples: sorted.length,
        avg: sorted.length ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : null,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
      };
    };

    const models = [...byModel.entries()]
      .map(([model, arr]) => ({ model, ...summarize(arr) }))
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 10);

    return NextResponse.json({
      period,
      total: { ...summarize(totals), unit: "ms" },
      ttft: { ...summarize(ttfts), unit: "ms" },
      models: models.map((m) => ({ ...m, unit: "ms" })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
