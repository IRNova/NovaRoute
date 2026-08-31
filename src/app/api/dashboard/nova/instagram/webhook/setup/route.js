import { NextResponse } from "next/server";
import { getNovaInstagramConfig, saveNovaInstagramConfig } from "@/lib/db/repos/novaRepo.js";
import { requireManagementAuth } from "@/lib/requireManagementAuth.js";

const GRAPH_API = "https://graph.facebook.com/v21.0";

// POST /api/dashboard/nova/instagram/webhook/setup — register webhook with Meta
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const config = await getNovaInstagramConfig();
    if (!config.pageAccessToken) {
      return NextResponse.json({ error: "Page access token is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const publicBaseUrl = body.publicBaseUrl || config.publicBaseUrl || "";
    if (!publicBaseUrl) {
      return NextResponse.json({ error: "Public base URL is required for webhook setup" }, { status: 400 });
    }

    const webhookUrl = `${publicBaseUrl.replace(/\/$/, "")}/api/dashboard/nova/instagram/webhook`;

    // Subscribe app to the page
    const subscribeRes = await fetch(`${GRAPH_API}/${config.pageId}/subscribed_apps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.pageAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscribed_fields: "messages,messaging_postbacks",
      }),
    });
    const subscribeData = await subscribeRes.json().catch(() => ({}));

    if (subscribeData.error) {
      return NextResponse.json(
        { error: subscribeData.error.message || "Failed to subscribe to events" },
        { status: 400 }
      );
    }

    // Save public base URL if provided
    if (publicBaseUrl && !config.publicBaseUrl) {
      await saveNovaInstagramConfig({ publicBaseUrl });
    }

    return NextResponse.json({
      ok: true,
      webhookUrl,
      subscribed: subscribeData.success || true,
      message: "Webhook registered successfully. Events: messages, messaging_postbacks",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Webhook setup failed" },
      { status: 500 }
    );
  }
}

// DELETE /api/dashboard/nova/instagram/webhook — unsubscribe
export async function DELETE(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const config = await getNovaInstagramConfig();
    if (!config.pageAccessToken || !config.pageId) {
      return NextResponse.json({ error: "Instagram not configured" }, { status: 400 });
    }

    const res = await fetch(`${GRAPH_API}/${config.pageId}/subscribed_apps`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.pageAccessToken}`,
      },
    });
    const data = await res.json().catch(() => ({}));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
