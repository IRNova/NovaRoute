import { NextResponse } from "next/server";
import { createProviderConnection } from "@/models";
import { kv } from "@/lib/db/helpers/kvStore.js";

const cfKv = kv("novaCloudflare");

// POST /api/dashboard/nova/cloudflare/auth/token — verify and save a Cloudflare API Token
export async function POST(request) {
  try {
    const body = await request.json();
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Step 1: Verify token is valid and active
    const verifyRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.success || verifyData.result?.status !== "active") {
      return NextResponse.json(
        { error: verifyData.errors?.[0]?.message || "Invalid or inactive token" },
        { status: 401 }
      );
    }

    // Step 2: Try to get user info (may fail if User:Read scope not granted)
    let user = null;
    try {
      const userRes = await fetch("https://api.cloudflare.com/client/v4/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userData = await userRes.json();
      if (userData.success && userData.result) user = userData.result;
    } catch { /* token may not have User:Read scope */ }

    // Step 3: Get account info as fallback
    let accountInfo = null;
    try {
      const acctRes = await fetch("https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const acctData = await acctRes.json();
      if (acctData.success && acctData.result?.length > 0) {
        accountInfo = acctData.result[0];
      }
    } catch { /* ignore */ }

    // Store connection
    await createProviderConnection({
      provider: "cloudflare",
      authType: "oauth",
      accessToken: token,
      tokenType: "bearer",
      expiresAt: null,
      testStatus: "active",
    });

    // Store user info
    const userInfo = {
      id: user?.id || verifyData.result?.id || "",
      email: user?.email || "",
      username: user?.username || "",
      firstName: user?.first_name || "",
      lastName: user?.last_name || "",
      accountName: accountInfo?.name || "",
      accountId: accountInfo?.id || "",
    };
    await cfKv.set("user", userInfo);

    return NextResponse.json({
      ok: true,
      user: userInfo,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to verify token" },
      { status: 500 }
    );
  }
}
