import { NextResponse } from "next/server";
import { getWebhooks, createWebhook } from "@/lib/db/repos/webhooksRepo.js";

export const dynamic = "force-dynamic";

// GET /api/webhooks - List webhooks
export async function GET() {
  try {
    const webhooks = await getWebhooks();
    return NextResponse.json({ webhooks });
  } catch (error) {
    console.log("Error fetching webhooks:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

// POST /api/webhooks - Create webhook
export async function POST(request) {
  try {
    const body = await request.json();
    const { url, events, secret, active, method } = body || {};

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }

    const normalizedEvents = Array.isArray(events)
      ? events.filter((e) => typeof e === "string" && e.trim())
      : [];

    if (normalizedEvents.length === 0) {
      return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
    }

    const webhook = await createWebhook({
      url: url.trim(),
      events: normalizedEvents,
      secret: typeof secret === "string" ? secret : "",
      active: active !== false,
      method: typeof method === "string" ? method : "POST",
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    console.log("Error creating webhook:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}
