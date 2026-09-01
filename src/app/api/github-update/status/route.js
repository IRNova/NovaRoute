import { NextResponse } from "next/server";
import { readUpdateStatus } from "@/lib/updater/launch";

export const dynamic = "force-dynamic";

// GET /api/github-update/status — progress of a running/last auto-update.
export async function GET() {
  const status = readUpdateStatus();
  if (!status) return NextResponse.json({ idle: true });
  return NextResponse.json({ active: !status.done, ...status });
}
