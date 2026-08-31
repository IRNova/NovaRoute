import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSettings, updateSettings } from "@/lib/localDb";
import bcrypt from "bcryptjs";
import { LOCALE_COOKIE, normalizeLocale, isSupportedLocale } from "@/i18n/config";
import { isLocalRequest } from "@/dashboardGuard";
import { verifyDashboardAuthToken, verifyDashboardPassword } from "@/lib/auth/dashboardSession";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";
import { syncAdminAccount } from "@/lib/db/repos/usersRepo.js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Claiming an unconfigured instance is an admin action, and this route is in the
// public allow-list so the first-run wizard can reach it. On a server the
// installer leaves `settings.password` empty (the initial password lives in
// INITIAL_PASSWORD), so without this gate the first stranger to reach the port
// could set their own password and own the panel. Remote callers must therefore
// prove they are the operator: a valid session, or the current initial password.
async function canClaimInstance(request, body) {
  if (isLocalRequest(request)) return { ok: true, local: true };

  const cookieStore = await cookies();
  if (await verifyDashboardAuthToken(cookieStore.get("auth_token")?.value)) {
    return { ok: true, local: false };
  }

  const proof = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  if (proof && (await verifyDashboardPassword(proof))) return { ok: true, local: false };

  return { ok: false, local: false };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const newPassword = typeof body.newPassword === "string" ? body.newPassword.trim() : "";

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    if (newPassword.length > 200) {
      return NextResponse.json({ error: "Password too long" }, { status: 400 });
    }

    let settings;
    try {
      settings = await getSettings();
    } catch (dbErr) {
      console.error("[API] Setup DB read failed:", dbErr);
      return NextResponse.json({ error: "Database error: " + dbErr.message }, { status: 500 });
    }

    if (settings.password) {
      return NextResponse.json({ error: "Already configured" }, { status: 409 });
    }

    const ip = getClientIp(request);
    const lock = checkLock(ip);
    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lock.retryAfter}s.`, retryAfter: lock.retryAfter },
        { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
      );
    }

    const claim = await canClaimInstance(request, body);
    if (!claim.ok) {
      recordFail(ip);
      return NextResponse.json(
        {
          error:
            "Remote first-time setup needs the initial password printed by the installer (INITIAL_PASSWORD), or a login from this machine.",
          code: "setup_requires_initial_password",
        },
        { status: 403 }
      );
    }
    if (!claim.local) recordSuccess(ip);

    let salt, hash;
    try {
      salt = await bcrypt.genSalt(10);
      hash = await bcrypt.hash(newPassword, salt);
    } catch (cryptErr) {
      console.error("[API] Setup bcrypt failed:", cryptErr);
      return NextResponse.json({ error: "Password hash error: " + cryptErr.message }, { status: 500 });
    }

    try {
      await updateSettings({ password: hash });
      // Give the instance a real admin identity from the start, so sessions,
      // roles and the audit trail have an account to point at.
      await syncAdminAccount(hash);
    } catch (writeErr) {
      console.error("[API] Setup DB write failed:", writeErr);
      return NextResponse.json({ error: "Database write error: " + writeErr.message }, { status: 500 });
    }

    const res = NextResponse.json({ ok: true });

    if (body.locale && isSupportedLocale(body.locale)) {
      const normalized = normalizeLocale(body.locale);
      res.cookies.set(LOCALE_COOKIE, normalized, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return res;
  } catch (error) {
    console.error("[API] Setup failed:", error);
    return NextResponse.json({ error: "Setup failed: " + error.message }, { status: 500 });
  }
}
