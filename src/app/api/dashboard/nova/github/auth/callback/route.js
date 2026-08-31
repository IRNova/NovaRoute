import { NextResponse } from "next/server";
import { createProviderConnection } from "@/models";
import { fetchAndStoreUser, getGitHubConfig } from "@/lib/nova/github.js";

// GET /api/dashboard/nova/github/auth/callback?code=...&state=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      const errorDesc = searchParams.get("error_description") || error;
      return redirectWithError(`GitHub authorization failed: ${errorDesc}`);
    }

    if (!code) {
      return redirectWithError("Missing authorization code");
    }

    // Validate state
    const cookieState = request.cookies.get("gh_oauth_state")?.value;
    if (!cookieState || cookieState !== state) {
      return redirectWithError("Invalid or expired OAuth state — please try again");
    }

    // Exchange code for token
    const ghCfg = await getGitHubConfig();
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: ghCfg.clientId,
        client_secret: ghCfg.clientSecret,
        code,
        state: state || "",
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return redirectWithError(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    if (!tokenData.access_token) {
      return redirectWithError("No access token received from GitHub");
    }

    // Store connection
    const connection = await createProviderConnection({
      provider: "github-app",
      authType: "oauth",
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || "bearer",
      scope: tokenData.scope,
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
      testStatus: "active",
    });

    // Fetch and store user info
    try {
      // Set token temporarily for ghFetch
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${tokenData.access_token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "NovaRoute-Bot",
        },
      });
      if (userRes.ok) {
        const user = await userRes.json();
        const { kv } = await import("@/lib/db/helpers/kvStore.js");
        const githubKv = kv("novaGitHub");
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
      }
    } catch { /* non-critical */ }

    // Clear state cookie
    const res = NextResponse.redirect(
      new URL("/dashboard/apps?github=connected", request.url)
    );
    res.cookies.set("gh_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    return redirectWithError(err.message || "OAuth callback failed");
  }
}

function redirectWithError(message) {
  const url = new URL("/dashboard/apps", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
  url.searchParams.set("github_error", message);
  return NextResponse.redirect(url);
}
