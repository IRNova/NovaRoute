import { NextResponse } from "next/server";
import { processInstagramUpdate, verifyIgWebhook } from "@/lib/nova/instagram.js";
import { getNovaInstagramConfig } from "@/lib/db/repos/novaRepo.js";

// GET /api/dashboard/nova/instagram/webhook — Meta webhook verification
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const config = await getNovaInstagramConfig();
    if (!config.verifyToken) {
      return NextResponse.json({ error: "Verify token not configured" }, { status: 400 });
    }

    if (verifyIgWebhook(mode, token, config.verifyToken)) {
      return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    return NextResponse.json({ error: "Verification failed" }, { status: 403 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Verification error" }, { status: 500 });
  }
}

// POST /api/dashboard/nova/instagram/webhook — receive events from Meta
export async function POST(request) {
  try {
    const rawBody = await request.text();

    // Verify signature if app secret is configured
    const config = await getNovaInstagramConfig();
    if (config.appSecret) {
      const signature = request.headers.get("x-hub-signature-256");
      const { verifyIgSignature } = await import("@/lib/nova/instagram.js");
      const valid = await verifyIgSignature(rawBody, signature);
      if (!valid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }

    const event = JSON.parse(rawBody);

    // Process in background — return 200 immediately to avoid Meta retries
    void processInstagramUpdate(event);

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never let webhook processing throw
    return NextResponse.json({ ok: true });
  }
}
