import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Telemetry for the analytics "Routing Health" tab: per-(taskType, provider, model)
// success/latency stats plus an hourly timeline (from open-sse/routing/predictor).
export async function GET() {
  try {
    const { getStatsSummary, getTimeline } = await import("open-sse/routing/predictor.js");
    const [summary, timeline] = await Promise.all([getStatsSummary(), getTimeline(24)]);
    return NextResponse.json({ summary, timeline });
  } catch (error) {
    console.error("[API] Failed to get routing stats:", error);
    return NextResponse.json({ summary: [], timeline: [] }, { status: 200 });
  }
}
