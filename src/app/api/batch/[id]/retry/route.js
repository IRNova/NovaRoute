import { NextResponse } from "next/server";
import { retryJob } from "@/lib/batchStore.js";

export const dynamic = "force-dynamic";

// POST /api/batch/[id]/retry - Retry failed items in a batch job
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const result = await retryJob(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ job: result.job });
  } catch (error) {
    console.log("Error retrying batch job:", error);
    return NextResponse.json({ error: "Failed to retry batch job" }, { status: 500 });
  }
}
