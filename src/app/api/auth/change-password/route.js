import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSettings, updateSettings } from "@/lib/localDb";
import { cookies } from "next/headers";
import {
  verifyDashboardPassword,
  revokeAllSessions,
  registerLoginSession,
  setDashboardAuthCookie,
} from "@/lib/auth/dashboardSession";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";
import { syncAdminAccount } from "@/lib/db/repos/usersRepo.js";

// POST /api/auth/change-password — set a new dashboard password from Settings.
// Requires an authenticated session (dashboardGuard deny-by-default covers
// /api/auth/* except the explicit public login/logout/status/oidc routes) AND
// the current password: a session cookie alone must not be enough to lock the
// owner out of their own panel.
export async function POST(request) {
  try {
    const body = await request.json();
    const password = body?.password;
    const currentPassword = body?.currentPassword;

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    if (password.length > 200) {
      return NextResponse.json({ error: "Password too long" }, { status: 400 });
    }

    const ip = getClientIp(request);
    const lock = checkLock(ip);
    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lock.retryAfter}s.`, retryAfter: lock.retryAfter },
        { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
      );
    }

    // A panel that has never had a password set (first run) has nothing to
    // re-authenticate against — the session gate is the only control there.
    const settings = await getSettings();
    const hasPassword = !!settings?.password || !!process.env.INITIAL_PASSWORD;
    if (hasPassword) {
      if (typeof currentPassword !== "string" || !(await verifyDashboardPassword(currentPassword))) {
        recordFail(ip);
        return NextResponse.json(
          { error: "Current password is incorrect", code: "current_password_required" },
          { status: 403 }
        );
      }
      recordSuccess(ip);
    }

    const hash = await bcrypt.hash(password, 10);
    await updateSettings({ password: hash });
    // The shared password and the built-in admin account are the same
    // credential; named accounts change their own password under /api/users.
    await syncAdminAccount(hash);

    // A password change should end every other device's session. Rotating the
    // JWT epoch invalidates this browser too, so mint a fresh cookie for the
    // admin who is standing right here.
    let sessionsRevoked = false;
    try {
      await revokeAllSessions();
      sessionsRevoked = true;
      const cookieStore = await cookies();
      const sid = await registerLoginSession({
        ip,
        userAgent: request.headers.get("user-agent") || "",
      });
      await setDashboardAuthCookie(cookieStore, request, { sid });
    } catch { /* best effort */ }

    return NextResponse.json({ success: true, sessionsRevoked });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
