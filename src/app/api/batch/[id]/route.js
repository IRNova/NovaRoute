import { NextResponse } from "next/server";
import { getJob, deleteJob } from "@/lib/batchStore.js";

export const dynamic = "force-dynamic";

// GET /api/batch/[id] - Get batch job details
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const job = getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (error) {
    console.log("Error fetching batch job:", error);
    return NextResponse.json({ error: "Failed to fetch batch job" }, { status: 500 });
  }
}

// DELETE /api/batch/[id] - Delete batch job
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const result = deleteJob(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error deleting batch job:", error);
    return NextResponse.json({ error: "Failed to delete batch job" }, { status: 500 });
  }
}
