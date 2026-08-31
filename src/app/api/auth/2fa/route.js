import { NextResponse } from "next/server";
import { getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import {
  getTotpConfig,
  ensureFreshSecret,
  enableTotp,
  disableTotp,
} from "@/lib/auth/totpState";
import { verifyTotp } from "@/lib/auth/totp";
import { verifyDashboardPassword } from "@/lib/auth/dashboardSession";

const NO_STORE = { "Cache-Control": "no-store" };

function deny() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
}

async function authed(request) {
  const token = request.cookies.get("auth_token")?.value;
  return !!(token && (await getDashboardAuthSession(token)));
}

// GET /api/auth/2fa — current status
export async function GET(request) {
  if (!(await authed(request))) return deny();
  try {
    const cfg = await getTotpConfig();
    // A pending secret exists only between setup-start and enable.
    return NextResponse.json(
      { enabled: cfg.enabled, pendingSetup: !cfg.enabled && !!cfg.secret },
      { headers: NO_STORE }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
  }
}

// POST /api/auth/2fa — actions:
//   setup            → { secret, otpauthUri }   (generates/rotates pending secret)
//   enable {code}    → validates code against pending secret and turns 2FA on
//   disable {code}   → requires a valid current code, turns 2FA off
export async function POST(request) {
  if (!(await authed(request))) return deny();
  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "setup") {
      const secret = await ensureFreshSecret();
      const account = process.env.INSTANCE_NAME || "admin";
      const { buildOtpauthUri } = await import("@/lib/auth/totp.js");
      return NextResponse.json({ secret, otpauthUri: buildOtpauthUri({ secret, account }) }, { headers: NO_STORE });
    }

    if (action === "enable") {
      const cfg = await getTotpConfig();
      if (!cfg.secret) return NextResponse.json({ error: "Run setup first" }, { status: 400, headers: NO_STORE });
      if (!verifyTotp(body?.code, cfg.secret)) {
        return NextResponse.json({ error: "Invalid authentication code" }, { status: 400, headers: NO_STORE });
      }
      await enableTotp();
      return NextResponse.json({ success: true, enabled: true }, { headers: NO_STORE });
    }

    if (action === "disable") {
      const passwordOk = typeof body?.password === "string"
        ? await verifyDashboardPassword(body.password)
        : false;
      const cfg = await getTotpConfig();
      const codeOk = cfg.secret && verifyTotp(body?.code, cfg.secret);
      if (!codeOk && !passwordOk) {
        return NextResponse.json({ error: "Provide your current authenticator code or dashboard password" }, { status: 400, headers: NO_STORE });
      }
      await disableTotp();
      return NextResponse.json({ success: true, enabled: false }, { headers: NO_STORE });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400, headers: NO_STORE });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
  }
}
