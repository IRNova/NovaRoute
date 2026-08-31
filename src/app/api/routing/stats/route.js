import { NextResponse } from "next/server";
import { getStatsSummary, getTimeline, pruneRoutingStats } from "open-sse/routing/predictor.js";
import { TASK_LABELS } from "open-sse/config/routingConfig.js";

/**
 * GET /api/routing/stats
 * Predictive routing stats for the report page:
 * rolling success rate, latency, token & cost averages per (taskType, provider, model).
 * Query params: ?taskType=xxx (filter) · ?timeline=1 (include hourly heatmap buckets)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskTypeFilter = searchParams.get("taskType");
    const includeTimeline = searchParams.get("timeline") === "1";
    let rows = await getStatsSummary();
    if (taskTypeFilter) {
      rows = rows.filter((r) => r.taskType === taskTypeFilter);
    }
    const timeline = includeTimeline ? await getTimeline(24) : null;
    return NextResponse.json({
      taskLabels: TASK_LABELS,
      rows,
      timeline,
      totalSamples: rows.reduce((sum, r) => sum + (r.samples || 0), 0),
    });
  } catch (error) {
    console.error("Error fetching routing stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch routing stats" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/routing/stats
 * Prune stale rows (default 90 days) or clear all with ?all=1
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get("all") === "1";
    const pruned = await pruneRoutingStats(clearAll ? 0 : 90);
    return NextResponse.json({ pruned });
  } catch (error) {
    console.error("Error pruning routing stats:", error);
    return NextResponse.json(
      { error: "Failed to prune routing stats" },
      { status: 500 }
    );
  }
}
