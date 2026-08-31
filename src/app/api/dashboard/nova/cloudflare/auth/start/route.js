import { NextResponse } from "next/server";
import { getCloudflareConfig } from "@/lib/nova/cloudflare.js";

// GET /api/dashboard/nova/cloudflare/auth/start
export async function GET(request) {
  try {
    const cfg = await getCloudflareConfig();
    if (!cfg.clientId) {
      return NextResponse.json({ error: "Cloudflare OAuth not configured — enter Client ID in the setup form" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const redirectUri = searchParams.get("redirect_uri") || `${new URL(request.url).origin}/api/dashboard/nova/cloudflare/auth/callback`;
    const state = crypto.randomUUID();

    const authUrl = new URL("https://dash.cloudflare.com/oauth2/auth");
    authUrl.searchParams.set("client_id", cfg.clientId);
    authUrl.searchParams.set("scope", cfg.scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");

    const res = NextResponse.json({ authUrl: authUrl.toString(), state });
    res.cookies.set("cf_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to start OAuth" }, { status: 500 });
  }
}
