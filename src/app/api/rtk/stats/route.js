import { NextResponse } from "next/server";
import { getRtkStats } from "@/lib/rtk/events.js";

// GET /api/rtk/stats — Token Saver savings ledger (all-time / today / 7d /
// daily timeline / per-provider). Estimated tokens assume ~4 chars per token;
// USD estimate uses RTK_EST_PRICE_PER_MTOK (default $0.5 per 1M input tokens).
export async function GET() {
  try {
    return NextResponse.json(getRtkStats());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
