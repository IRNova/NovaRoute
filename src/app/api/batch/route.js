import { NextResponse } from "next/server";
import { listJobs, createJob } from "@/lib/batchStore.js";

export const dynamic = "force-dynamic";

// GET /api/batch - List batch jobs
export async function GET() {
  try {
    const jobs = listJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.log("Error listing batch jobs:", error);
    return NextResponse.json({ error: "Failed to list batch jobs" }, { status: 500 });
  }
}

// POST /api/batch - Create a new batch job
export async function POST(request) {
  try {
    const body = await request.json();
    const result = createJob(body || {});
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ job: result.job }, { status: 201 });
  } catch (error) {
    console.log("Error creating batch job:", error);
    return NextResponse.json({ error: "Failed to create batch job" }, { status: 500 });
  }
}
