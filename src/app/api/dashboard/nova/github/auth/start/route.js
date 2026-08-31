import { NextResponse } from "next/server";
import { getGitHubConfig } from "@/lib/nova/github.js";

// GET /api/dashboard/nova/github/auth/start
// Redirects to GitHub OAuth authorization page
export async function GET(request) {
  try {
    const cfg = await getGitHubConfig();
    if (!cfg.clientId) {
      return NextResponse.json({ error: "GitHub OAuth not configured — enter Client ID in the setup form" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const redirectUri = searchParams.get("redirect_uri") || `${new URL(request.url).origin}/api/dashboard/nova/github/auth/callback`;

    const state = crypto.randomUUID();

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", cfg.clientId);
    authUrl.searchParams.set("scope", cfg.scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("redirect_uri", redirectUri);

    // Store state temporarily via cookie (5 min TTL)
    const res = NextResponse.json({ authUrl: authUrl.toString(), state });
    res.cookies.set("gh_oauth_state", state, {
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
