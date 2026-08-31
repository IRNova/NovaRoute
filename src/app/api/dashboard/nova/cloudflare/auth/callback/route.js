import { NextResponse } from "next/server";
import { createProviderConnection } from "@/models";
import { getCloudflareConfig } from "@/lib/nova/cloudflare.js";

// GET /api/dashboard/nova/cloudflare/auth/callback?code=...&state=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return redirectWithError(`Cloudflare authorization failed: ${error}`);
    }

    if (!code) {
      return redirectWithError("Missing authorization code");
    }

    // Validate state
    const cookieState = request.cookies.get("cf_oauth_state")?.value;
    if (!cookieState || cookieState !== state) {
      return redirectWithError("Invalid or expired OAuth state — please try again");
    }

    // Exchange code for token
    const cfCfg = await getCloudflareConfig();
    const tokenRes = await fetch("https://dash.cloudflare.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: cfCfg.clientId,
        client_secret: cfCfg.clientSecret,
        code,
        redirect_uri: `${new URL(request.url).origin}/api/dashboard/nova/cloudflare/auth/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return redirectWithError(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    if (!tokenData.access_token) {
      return redirectWithError("No access token received from Cloudflare");
    }

    // Store connection
    await createProviderConnection({
      provider: "cloudflare",
      authType: "oauth",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || "bearer",
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null,
      scope: tokenData.scope,
      testStatus: "active",
    });

    // Fetch and store user info
    try {
      const userRes = await fetch("https://api.cloudflare.com/client/v4/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.result) {
          const { kv } = await import("@/lib/db/helpers/kvStore.js");
          const cfKv = kv("novaCloudflare");
          await cfKv.set("user", {
            id: userData.result.id,
            email: userData.result.email,
            username: userData.result.username,
            firstName: userData.result.first_name,
            lastName: userData.result.last_name,
          });
        }
      }
    } catch { /* non-critical */ }

    // Clear state cookie
    const res = NextResponse.redirect(
      new URL("/dashboard/apps?cloudflare=connected", request.url)
    );
    res.cookies.set("cf_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    return redirectWithError(err.message || "OAuth callback failed");
  }
}

function redirectWithError(message) {
  const url = new URL("/dashboard/apps", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
  url.searchParams.set("cloudflare_error", message);
  return NextResponse.redirect(url);
}
