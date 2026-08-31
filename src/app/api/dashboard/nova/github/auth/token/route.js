import { NextResponse } from "next/server";
import { createProviderConnection } from "@/models";
import { kv } from "@/lib/db/helpers/kvStore.js";

const githubKv = kv("novaGitHub");

// POST /api/dashboard/nova/github/auth/token — verify and save a GitHub PAT
export async function POST(request) {
  try {
    const body = await request.json();
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Verify token by calling GitHub API
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "NovaRoute-Bot",
      },
    });

    if (!userRes.ok) {
      const err = await userRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || `Invalid token (HTTP ${userRes.status})` },
        { status: 401 }
      );
    }

    const user = await userRes.json();

    // Store connection
    await createProviderConnection({
      provider: "github-app",
      authType: "oauth",
      accessToken: token,
      tokenType: "bearer",
      scope: "repo read:user user:email",
      expiresAt: null,
      testStatus: "active",
    });

    // Store user info
    await githubKv.set("user", {
      login: user.login,
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      public_repos: user.public_repos,
      followers: user.followers,
      following: user.following,
    });

    return NextResponse.json({
      ok: true,
      user: {
        login: user.login,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        public_repos: user.public_repos,
        followers: user.followers,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to verify token" },
      { status: 500 }
    );
  }
}
