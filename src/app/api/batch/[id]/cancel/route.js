import { NextResponse } from "next/server";
import { cancelJob } from "@/lib/batchStore.js";

export const dynamic = "force-dynamic";

// POST /api/batch/[id]/cancel - Cancel a running batch job
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const result = cancelJob(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ job: result.job });
  } catch (error) {
    console.log("Error cancelling batch job:", error);
    return NextResponse.json({ error: "Failed to cancel batch job" }, { status: 500 });
  }
}
