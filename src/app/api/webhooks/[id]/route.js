import { NextResponse } from "next/server";
import { getWebhookById, updateWebhook, deleteWebhook } from "@/lib/db/repos/webhooksRepo.js";

export const dynamic = "force-dynamic";

// GET /api/webhooks/[id] - Get a single webhook
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const webhook = await getWebhookById(id);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    return NextResponse.json({ webhook });
  } catch (error) {
    console.log("Error fetching webhook:", error);
    return NextResponse.json({ error: "Failed to fetch webhook" }, { status: 500 });
  }
}

// PUT /api/webhooks/[id] - Update webhook
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { url, events, secret, active, method } = body || {};

    const existing = await getWebhookById(id);
    if (!existing) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const updateData = {};
    if (url !== undefined) {
      if (!url || typeof url !== "string" || !url.trim()) {
        return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
      }
      updateData.url = url.trim();
    }
    if (events !== undefined) {
      const normalizedEvents = Array.isArray(events)
        ? events.filter((e) => typeof e === "string" && e.trim())
        : [];
      if (normalizedEvents.length === 0) {
        return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
      }
      updateData.events = normalizedEvents;
    }
    if (secret !== undefined) updateData.secret = secret;
    if (active !== undefined) updateData.active = active === true;
    if (method !== undefined) updateData.method = method;

    const updated = await updateWebhook(id, updateData);
    return NextResponse.json({ webhook: updated });
  } catch (error) {
    console.log("Error updating webhook:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

// DELETE /api/webhooks/[id] - Delete webhook
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteWebhook(id);
    if (!deleted) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Webhook deleted successfully" });
  } catch (error) {
    console.log("Error deleting webhook:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
