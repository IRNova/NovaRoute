import { NextResponse } from "next/server";
import { isLocalRequest } from "@/dashboardGuard";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { normalizeRole } from "@/lib/auth/roles";
import { startUpdate, readUpdateStatus } from "@/lib/updater/launch";

export const dynamic = "force-dynamic";

const BRANCH = process.env.NOVAROUTE_UPDATE_BRANCH || "main";

/**
 * POST /api/setup/update
 *
 * Starts a self-update from the tracked git branch and returns immediately;
 * progress is polled from GET /api/setup/update.
 *
 * Access: an admin dashboard session, or a request from the host itself.
 * This used to be loopback-only, which made it unreachable in the one
 * deployment that needs it: behind Caddy every request is stamped as
 * via-proxy, so isLocalRequest is false and the button returned 403 on every
 * domain install. The route is under ADMIN_ONLY_PREFIXES in the role matrix,
 * so the guard has already required an admin; this is the second lock.
 */
async function isAllowed(request) {
  const session = await getDashboardAuthSession(request.cookies.get("auth_token")?.value);
  if (session && normalizeRole(session.role || "admin") === "admin") return true;
  // Host-local callers (the CLI, an operator on the box) keep working.
  return isLocalRequest(request);
}

export async function POST(request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
  }

  const result = startUpdate({ mode: "git", ref: BRANCH });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      success: true,
      started: true,
      branch: BRANCH,
      message: "Update started. The service will restart when the build finishes.",
      poll: "/api/setup/update",
    },
    { status: 202 }
  );
}

/** GET /api/setup/update — progress of the running or last update. */
export async function GET(request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
  }
  const status = readUpdateStatus();
  if (!status) return NextResponse.json({ idle: true, logs: [] });
  return NextResponse.json({
    idle: false,
    active: !status.done,
    ...status,
    logs: status.log || [],
  });
}
