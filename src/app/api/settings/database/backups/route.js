import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { BACKUPS_DIR } from "@/lib/db/paths.js";
import { getAdapter } from "@/lib/db/driver.js";

function deny() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// GET /api/settings/database/backups — list automatic daily backups.
export async function GET(request) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return deny();
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return NextResponse.json({ backups: [] });
    const backups = fs
      .readdirSync(BACKUPS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("daily-"))
      .map((e) => {
        const file = path.join(BACKUPS_DIR, e.name, "data.sqlite");
        let sizeMB = 0;
        let createdAt = null;
        try {
          const st = fs.statSync(file);
          sizeMB = Math.round((st.size / (1024 * 1024)) * 100) / 100;
          createdAt = st.mtime.toISOString();
        } catch {}
        return { name: e.name, sizeMB, createdAt };
      })
      .filter((b) => b.createdAt)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 30);
    return NextResponse.json({ backups });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
