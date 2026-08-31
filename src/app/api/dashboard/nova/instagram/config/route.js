import { NextResponse } from "next/server";
import { getNovaInstagramConfig, saveNovaInstagramConfig } from "@/lib/db/repos/novaRepo.js";
import { requireManagementAuth } from "@/lib/requireManagementAuth.js";

// GET /api/dashboard/nova/instagram/config
export async function GET(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const config = await getNovaInstagramConfig();
    // Mask sensitive fields
    const masked = {
      ...config,
      pageAccessToken: config.pageAccessToken
        ? `${config.pageAccessToken.slice(0, 8)}••••${config.pageAccessToken.slice(-4)}`
        : "",
      appSecret: config.appSecret
        ? `${config.appSecret.slice(0, 4)}••••${config.appSecret.slice(-4)}`
        : "",
      hasToken: Boolean(config.pageAccessToken),
      hasSecret: Boolean(config.appSecret),
    };
    return NextResponse.json({ config: masked });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to load Instagram config" },
      { status: 500 }
    );
  }
}

// PUT /api/dashboard/nova/instagram/config
export async function PUT(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const patch = {};

    // Only allow known fields
    const allowedFields = [
      "pageAccessToken", "pageId", "verifyToken", "appSecret",
      "adminIgUserId", "enabled", "autoApproveAfterN",
      "alwaysReply", "behaviorPrompt", "blacklist",
    ];
    for (const key of allowedFields) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    // Auto-generate verify token if not set
    if (!patch.verifyToken) {
      const current = await getNovaInstagramConfig();
      if (!current.verifyToken) {
        const { randomBytes } = await import("node:crypto");
        patch.verifyToken = randomBytes(16).toString("hex");
      }
    }

    const saved = await saveNovaInstagramConfig(patch);

    const masked = {
      ...saved,
      pageAccessToken: saved.pageAccessToken
        ? `${saved.pageAccessToken.slice(0, 8)}••••${saved.pageAccessToken.slice(-4)}`
        : "",
      appSecret: saved.appSecret
        ? `${saved.appSecret.slice(0, 4)}••••${saved.appSecret.slice(-4)}`
        : "",
      hasToken: Boolean(saved.pageAccessToken),
      hasSecret: Boolean(saved.appSecret),
    };

    return NextResponse.json({ config: masked });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to save Instagram config" },
      { status: 500 }
    );
  }
}
