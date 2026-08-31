import { NextResponse } from "next/server";
import { getDashboardAuthSession, listSessions, revokeSession } from "@/lib/auth/dashboardSession";

function deny() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function authed(request) {
  const token = request.cookies.get("auth_token")?.value;
  return !!(token && (await getDashboardAuthSession(token)));
}

// GET /api/auth/sessions — list known login sessions
export async function GET(request) {
  if (!(await authed(request))) return deny();
  try {
    const sessions = await listSessions();
    return NextResponse.json(
      { sessions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/auth/sessions?sid=... — revoke one device session
export async function DELETE(request) {
  if (!(await authed(request))) return deny();
  try {
    const sid = new URL(request.url).searchParams.get("sid");
    const current = request.cookies.get("auth_token")?.value;
    const session = current ? await getDashboardAuthSession(current) : null;
    if (!sid) return NextResponse.json({ error: "sid required" }, { status: 400 });
    if (session?.sid === sid) {
      return NextResponse.json({ error: "Use 'Log Out Everywhere' or plain logout for the current device" }, { status: 400 });
    }
    const ok = await revokeSession(sid);
    return NextResponse.json({ success: ok });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
