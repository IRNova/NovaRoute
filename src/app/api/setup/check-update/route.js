import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { resolveAppRoot } from "@/lib/updater/appRoot.js";

export const dynamic = "force-dynamic";

const REPO = process.env.GITHUB_UPDATE_REPO || "IRNova/NovaRoute";
const BRANCH = process.env.NOVAROUTE_UPDATE_BRANCH || "main";

// The service sets WorkingDirectory=<install dir>, but the Next standalone
// server chdir()s into .next/standalone on boot, so cwd is the build output.
// Reporting from there said "not a git checkout" on a perfectly good install.
function installDir() {
  return resolveAppRoot();
}

function git(args, dir) {
  try {
    return execSync(`git ${args}`, { cwd: dir, encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/**
 * GET /api/setup/check-update
 *
 * Compares the checked-out commit against the branch head on GitHub.
 */
export async function GET() {
  try {
    const dir = installDir();
    let currentVersion = "unknown";
    try {
      currentVersion = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")).version || "unknown";
    } catch {}

    // Both sides are abbreviated the same way. `git rev-parse --short` picks a
    // length from repository size, so comparing it against a fixed 7-character
    // slice of the API sha could report a phantom update.
    const localFull = git("rev-parse HEAD", dir);
    const localSha = localFull.slice(0, 7);
    const isGitCheckout = existsSync(join(dir, ".git"));
    const dirty = isGitCheckout ? git("status --porcelain", dir).length > 0 : false;

    let latestSha = "";
    let latestVersion = "";
    let commitMessage = "";
    let commitDate = "";
    let updateAvailable = false;
    let checkError = "";

    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "NovaRoute-Updater" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        latestSha = String(data.sha || "").slice(0, 7);
        commitMessage = data.commit?.message?.split("\n")[0] || "";
        commitDate = data.commit?.committer?.date || "";
        if (localSha && latestSha && localSha !== latestSha) updateAvailable = true;
      } else {
        checkError = `GitHub returned ${res.status}`;
      }

      // The version the update would bring, read from the branch's own
      // package.json, so the panel can say "1.1.0 -> 1.2.0" instead of only
      // showing two commit hashes.
      if (updateAvailable) {
        try {
          const pkgRes = await fetch(
            `https://raw.githubusercontent.com/${REPO}/${BRANCH}/package.json`,
            { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "NovaRoute-Updater" } }
          );
          if (pkgRes.ok) latestVersion = (await pkgRes.json())?.version || "";
        } catch {
          // Version is a nicety; the sha comparison already decided.
        }
      }
    } catch (err) {
      checkError = `Could not reach GitHub: ${err.message}`;
    }

    return NextResponse.json({
      current: currentVersion,
      currentSha: localSha,
      latestVersion: latestVersion || null,
      versionChanged: Boolean(latestVersion && latestVersion !== currentVersion),
      latest: updateAvailable ? `${latestVersion || currentVersion}+${latestSha}` : currentVersion,
      updateAvailable,
      commitSha: latestSha,
      commitMessage,
      commitDate,
      branch: BRANCH,
      isGitCheckout,
      // A build rewrites tracked files (tsconfig.json is the usual one). The
      // updater resets the tree, so this is informational, not a blocker.
      workingTreeDirty: dirty,
      canSelfUpdate: isGitCheckout,
      error: checkError || undefined,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
