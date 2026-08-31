import { NextResponse } from "next/server";
import { deliverWebhook } from "@/lib/webhooks/deliver.js";

export const dynamic = "force-dynamic";

// POST /api/webhooks/test - Test an arbitrary webhook endpoint
export async function POST(request) {
  try {
    const body = await request.json();
    const { url, secret, event, method } = body || {};

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }

    const result = await deliverWebhook(url.trim(), {
      secret: typeof secret === "string" ? secret : undefined,
      event: typeof event === "string" ? event : "webhook.test",
      method: typeof method === "string" ? method : "POST",
    });

    return NextResponse.json({
      success: result.ok,
      status: result.status,
      statusText: result.statusText,
    });
  } catch (error) {
    console.log("Error testing webhook endpoint:", error);
    return NextResponse.json({ error: "Failed to test webhook endpoint" }, { status: 500 });
  }
}
