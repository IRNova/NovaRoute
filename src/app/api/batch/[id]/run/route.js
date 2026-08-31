import { NextResponse } from "next/server";
import { runJob } from "@/lib/batchStore.js";

export const dynamic = "force-dynamic";

// POST /api/batch/[id]/run - Start or resume a batch job
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const result = await runJob(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ job: result.job });
  } catch (error) {
    console.log("Error running batch job:", error);
    return NextResponse.json({ error: "Failed to run batch job" }, { status: 500 });
  }
}
