import { NextResponse } from "next/server";
import { getGitHubConnection, getGitHubUser, getGitHubConfig, saveGitHubOAuthConfig } from "@/lib/nova/github.js";

// GET /api/dashboard/nova/github/auth/status
export async function GET() {
  try {
    const conn = await getGitHubConnection();
    const user = await getGitHubUser();
    const cfg = await getGitHubConfig();

    return NextResponse.json({
      connected: Boolean(conn?.accessToken),
      hasOAuth: Boolean(cfg.clientId),
      user: user ? {
        login: user.login,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        public_repos: user.public_repos,
        followers: user.followers,
        following: user.following,
      } : null,
      scope: conn?.scope || null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to check status" }, { status: 500 });
  }
}

// PUT /api/dashboard/nova/github/auth/status — save OAuth Client ID / Secret
export async function PUT(request) {
  try {
    const body = await request.json();
    const patch = {};
    if (body.clientId !== undefined) patch.clientId = String(body.clientId).trim();
    if (body.clientSecret !== undefined) patch.clientSecret = String(body.clientSecret).trim();
    if (!patch.clientId && !patch.clientSecret) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }
    const saved = await saveGitHubOAuthConfig(patch);
    return NextResponse.json({ ok: true, config: { clientId: saved.clientId || "", hasSecret: Boolean(saved.clientSecret) } });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to save" }, { status: 500 });
  }
}
