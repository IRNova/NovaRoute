import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  readPre2faToken,
  setDashboardAuthCookie,
  registerLoginSession,
} from "@/lib/auth/dashboardSession";
import { getTotpConfig } from "@/lib/auth/totpState";
import { verifyTotp } from "@/lib/auth/totp";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

// POST /api/auth/login/2fa — second factor: { preToken, code }
export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const lock = checkLock(ip);
    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lock.retryAfter}s.`, retryAfter: lock.retryAfter },
        { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
      );
    }

    const { preToken, code } = await request.json();
    const pending = await readPre2faToken(preToken);
    if (!pending) {
      return NextResponse.json(
        { error: "Login session expired — start again." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const totp = await getTotpConfig();
    if (!totp.enabled || !totp.secret) {
      return NextResponse.json({ error: "2FA is not enabled" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    if (!verifyTotp(code, totp.secret)) {
      recordFail(ip);
      return NextResponse.json({ error: "Invalid authentication code" }, { status: 401, headers: NO_STORE_HEADERS });
    }

    recordSuccess(ip);
    // The second factor completes the login the password started, for the same
    // account — the identity comes from the pre-2FA token, never from the body.
    const sid = await registerLoginSession({
      ip,
      userAgent: request.headers.get("user-agent") || "",
      username: pending.username || "admin",
    });
    const cookieStore = await cookies();
    await setDashboardAuthCookie(cookieStore, request, {
      sid,
      uid: pending.uid || null,
      username: pending.username || "admin",
      role: pending.role || "admin",
    });

    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
