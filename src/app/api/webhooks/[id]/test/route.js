import { NextResponse } from "next/server";
import { getWebhookById, recordWebhookDelivery } from "@/lib/db/repos/webhooksRepo.js";
import { deliverWebhook } from "@/lib/webhooks/deliver.js";

export const dynamic = "force-dynamic";

// POST /api/webhooks/[id]/test - Test a saved webhook endpoint
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const webhook = await getWebhookById(id);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const result = await deliverWebhook(webhook.url, {
      secret: webhook.secret,
      event: "webhook.test",
      method: webhook.method,
    });

    await recordWebhookDelivery(id, result);

    return NextResponse.json({
      success: result.ok,
      status: result.status,
      statusText: result.statusText,
    });
  } catch (error) {
    console.log("Error testing webhook:", error);
    return NextResponse.json({ error: "Failed to test webhook" }, { status: 500 });
  }
}
