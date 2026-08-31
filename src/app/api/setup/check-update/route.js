import { NextResponse } from "next/server";

/**
 * GET /api/setup/check-update
 *
 * Checks GitHub for the latest version and compares with installed version.
 */
export async function GET() {
  try {
    let currentVersion = "unknown";
    let localSha = "";

    try {
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { execSync } = await import("node:child_process");
      const installDir = process.env.INSTALL_DIR || "/opt/novaroute";
      const pkg = JSON.parse(readFileSync(join(installDir, "package.json"), "utf-8"));
      currentVersion = pkg.version || "unknown";
      try {
        localSha = execSync("git rev-parse --short HEAD", {
          cwd: installDir, encoding: "utf-8", timeout: 5000,
        }).trim();
      } catch {}
    } catch {}

    let latestSha = "";
    let commitMessage = "";
    let commitDate = "";
    let updateAvailable = false;

    try {
      const res = await fetch("https://api.github.com/repos/IRNova/NovaRoute/commits/main", {
        headers: { "Accept": "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        latestSha = data.sha?.substring(0, 7) || "";
        commitMessage = data.commit?.message?.split("\n")[0] || "";
        commitDate = data.commit?.committer?.date || "";
        if (localSha && latestSha && localSha !== latestSha) {
          updateAvailable = true;
        }
      }
    } catch {}

    return NextResponse.json({
      current: currentVersion,
      latest: updateAvailable ? `${currentVersion}+${latestSha}` : currentVersion,
      updateAvailable,
      commitSha: latestSha,
      commitMessage,
      commitDate,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
