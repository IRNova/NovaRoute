import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATUS_DIR = () => path.join(process.cwd(), ".update-status");
const STATUS_FILE = () => path.join(STATUS_DIR(), "status.json");

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE(), "utf8"));
  } catch {
    return null;
  }
}

// POST /api/github-update/apply — body: { tag: "v1.2.3" }
export async function POST(request) {
  // Only the Linux/systemd server deployment can self-restart reliably.
  if (process.platform !== "linux" || !fs.existsSync("/usr/bin/systemctl")) {
    return NextResponse.json(
      { error: "Auto-update is only supported on the Linux server deployment (systemd)." },
      { status: 400 }
    );
  }

  let tag = "";
  try {
    const body = await request.json();
    tag = String(body?.tag || "").trim();
  } catch {
    /* fallthrough */
  }
  if (!/^[A-Za-z0-9._\-]+$/.test(tag)) {
    return NextResponse.json({ error: "A valid release tag is required" }, { status: 400 });
  }

  // Refuse to double-run while an update is already in flight.
  const status = readStatus();
  if (status && !status.done && Date.now() - new Date(status.updatedAt || 0).getTime() < 30 * 60 * 1000) {
    return NextResponse.json({ error: "An update is already in progress" }, { status: 409 });
  }

  const workerPath = path.join(process.cwd(), "src", "lib", "updater", "githubUpdateWorker.js");
  if (!fs.existsSync(workerPath)) {
    return NextResponse.json({ error: "Updater worker not found in this installation" }, { status: 500 });
  }

  try {
    fs.mkdirSync(STATUS_DIR(), { recursive: true });
    fs.writeFileSync(
      STATUS_FILE(),
      JSON.stringify({ tag, step: "starting", pct: 1, done: false, error: null, updatedAt: new Date().toISOString(), log: [] }, null, 2)
    );
    const child = spawn(process.execPath, [workerPath, tag], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
      env: process.env,
    });
    child.unref();
  } catch (err) {
    return NextResponse.json({ error: `Failed to start updater: ${err.message}` }, { status: 500 });
  }

  return NextResponse.json({ started: true, tag });
}
