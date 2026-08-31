import { NextResponse } from "next/server";
import { isLocalRequest } from "@/dashboardGuard";

/**
 * POST /api/setup/update
 *
 * Pulls latest code from git, rebuilds, and restarts the service.
 * Only accessible from localhost.
 */
export async function POST(request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { execSync } = await import("node:child_process");
  const installDir = process.env.INSTALL_DIR || "/opt/novaroute";
  const serviceName = "novaroute";
  const logs = [];

  try {
    logs.push("Pulling latest code...");
    const pullResult = execSync("git pull origin main", {
      cwd: installDir, encoding: "utf-8", timeout: 120000,
    });
    logs.push(pullResult.trim());

    logs.push("Installing dependencies...");
    execSync("npm install --omit=dev --no-audit --no-fund 2>&1", {
      cwd: installDir, encoding: "utf-8", timeout: 300000,
    });
    logs.push("Dependencies installed.");

    logs.push("Building production bundle...");
    execSync("npm run build 2>&1", {
      cwd: installDir, encoding: "utf-8", timeout: 600000,
    });
    logs.push("Build complete.");

    logs.push("Restarting service...");
    execSync(`systemctl restart ${serviceName}`, { encoding: "utf-8", timeout: 30000 });

    logs.push("Update complete!");
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    logs.push(`Error: ${error.message}`);
    return NextResponse.json({ success: false, logs, error: error.message }, { status: 500 });
  }
}
