import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { setDashboardAuthCookie, verifyMasterPassword, createPre2faToken, registerLoginSession } from "@/lib/auth/dashboardSession";
import { timingSafeEqualStr } from "@/lib/auth/timingSafe";
import { isOidcConfigured } from "@/lib/auth/oidc";
import { getTotpConfig } from "@/lib/auth/totpState";
import { verifyTotp } from "@/lib/auth/totp";
import { checkLock, recordFail, recordSuccess, getClientIp } from "@/lib/auth/loginLimiter";
import { isLocalRequest } from "@/dashboardGuard";
import { verifyUserPassword, findAdminByPassword, recordLogin, countUsers } from "@/lib/db/repos/usersRepo.js";

const RESET_HINT = "Forgot password? Reset to default via NovaRoute CLI → Settings → Reset Password to Default.";
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function isTunnelRequest(request, settings) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
  const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
  return (tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost);
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const lock = checkLock(ip);
    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lock.retryAfter}s. ${RESET_HINT}`, retryAfter: lock.retryAfter, resetHint: RESET_HINT },
        { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
      );
    }

    const { password, username } = await request.json();
    const settings = await getSettings();

    // Block login via tunnel/tailscale if dashboard access is disabled
    if (isTunnelRequest(request, settings) && settings.tunnelDashboardAccess !== true) {
      return NextResponse.json({ error: "Dashboard access via tunnel is disabled" }, { status: 403 });
    }

    // Default password is '123456' if not set
    const storedHash = settings.password;

    if (settings.authMode === "oidc" && isOidcConfigured(settings)) {
      return NextResponse.json({ error: "Password login is disabled. Use OIDC sign in." }, { status: 403 });
    }

    let isValid = false;
    let usedMasterPassword = false;
    // Identity of the account that logged in. Null means the legacy
    // single-password path (no user row yet) — that session is treated as admin,
    // which is what it always was.
    let account = null;

    if (typeof username === "string" && username.trim()) {
      // Named login: username + password against the users table.
      account = await verifyUserPassword(username.trim(), password);
      isValid = !!account;
    } else if (storedHash) {
      // Bare password: match it against an admin account first (so the session
      // carries a real identity), then fall back to the stored settings hash.
      account = await findAdminByPassword(password);
      isValid = !!account || (await bcrypt.compare(password, storedHash));
    } else {
      // Use env var or default
      const initialPassword = process.env.INITIAL_PASSWORD || "123456";
      isValid = timingSafeEqualStr(password, initialPassword);
    }

    // Break-glass recovery: ADMIN_MASTER_PASSWORD env always grants access.
    if (!isValid && (await verifyMasterPassword(password))) {
      isValid = true;
      usedMasterPassword = true;
    }

    if (isValid) {
      // Never let the factory-default password authenticate from a remote
      // connection on a public interface — force first-time setup locally
      // (localhost login / INITIAL_PASSWORD) so an internet-exposed instance
      // with untouched credentials cannot be taken over.
      const usingDefaultPassword = !storedHash && !process.env.INITIAL_PASSWORD;
      if (usingDefaultPassword && !usedMasterPassword && !isLocalRequest(request)) {
        return NextResponse.json(
          {
            error: "Default password is not accepted from remote connections. Log in once from localhost to set a password, or set INITIAL_PASSWORD.",
            code: "default_password_remote",
            resetHint: RESET_HINT,
          },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      recordSuccess(ip);
      const cookieStore = await cookies();

      // Two-factor: password correct but a TOTP code is still required before
      // any dashboard cookie is issued.
      try {
        const totp = await getTotpConfig();
        if (totp.enabled && totp.secret) {
          const preToken = await createPre2faToken({
            uid: account?.id || null,
            username: account?.username || "admin",
            role: account?.role || "admin",
          });
          return NextResponse.json(
            { success: true, requiresTwoFactor: true, preToken },
            { headers: NO_STORE_HEADERS }
          );
        }
      } catch {
        // fail-open on state read errors → proceed as single-factor
      }

      const sid = await registerLoginSession({
        ip,
        userAgent: request.headers.get("user-agent") || "",
        username: account?.username || "admin",
      });
      await setDashboardAuthCookie(cookieStore, request, {
        sid,
        uid: account?.id || null,
        username: account?.username || "admin",
        role: account?.role || "admin",
      });
      if (account?.id) await recordLogin(account.id);

      // Default password still in use on a remote client → force a password
      // change before the dashboard is exposed remotely (keeps local UX intact).
      const mustChangePassword =
        !storedHash && !process.env.INITIAL_PASSWORD && !isLocalRequest(request);

      return NextResponse.json(
        {
          success: true,
          mustChangePassword,
          username: account?.username || "admin",
          role: account?.role || "admin",
          multiUser: (await countUsers()) > 1,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const { remainingBeforeLock } = recordFail(ip);
    const postLock = checkLock(ip);
    if (postLock.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${postLock.retryAfter}s. ${RESET_HINT}`, retryAfter: postLock.retryAfter, resetHint: RESET_HINT },
        { status: 429, headers: { "Retry-After": String(postLock.retryAfter) } }
      );
    }
    return NextResponse.json(
      { error: `Invalid password. ${remainingBeforeLock} attempt(s) left before lockout.`, remainingBeforeLock },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
