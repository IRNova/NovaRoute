import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/github-update/status — progress of a running/last auto-update.
export async function GET() {
  try {
    const file = path.join(process.cwd(), ".update-status", "status.json");
    const status = JSON.parse(fs.readFileSync(file, "utf8"));
    return NextResponse.json({ active: !status.done, ...status });
  } catch {
    return NextResponse.json({ idle: true });
  }
}
