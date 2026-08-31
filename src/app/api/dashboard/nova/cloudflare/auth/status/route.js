import { NextResponse } from "next/server";
import { getCloudflareConnection, getCloudflareUser, getCloudflareConfig, saveCloudflareOAuthConfig } from "@/lib/nova/cloudflare.js";

// GET /api/dashboard/nova/cloudflare/auth/status
export async function GET() {
  try {
    const conn = await getCloudflareConnection();
    const user = await getCloudflareUser();
    const cfg = await getCloudflareConfig();

    return NextResponse.json({
      connected: Boolean(conn?.accessToken),
      hasOAuth: Boolean(cfg.clientId),
      user: user ? {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      } : null,
      scope: conn?.scope || null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to check status" }, { status: 500 });
  }
}

// PUT /api/dashboard/nova/cloudflare/auth/status — save OAuth Client ID / Secret
export async function PUT(request) {
  try {
    const body = await request.json();
    const patch = {};
    if (body.clientId !== undefined) patch.clientId = String(body.clientId).trim();
    if (body.clientSecret !== undefined) patch.clientSecret = String(body.clientSecret).trim();
    if (!patch.clientId && !patch.clientSecret) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }
    const saved = await saveCloudflareOAuthConfig(patch);
    return NextResponse.json({ ok: true, config: { clientId: saved.clientId || "", hasSecret: Boolean(saved.clientSecret) } });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to save" }, { status: 500 });
  }
}
