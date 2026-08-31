import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import {
  getNovaTelegramConfig,
  saveNovaTelegramConfig,
} from "@/lib/db/repos/novaRepo.js";
import { generateWebhookSecret } from "@/lib/nova/telegram.js";

export const dynamic = "force-dynamic";

const WEBHOOK_PATH = "/api/dashboard/nova/telegram/webhook";

function deriveBaseUrl(request) {
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) return `${proto || "http"}://${host}`;
  return new URL(request.url).origin;
}

// POST /api/dashboard/nova/telegram/webhook/setup — register the webhook.
export async function POST(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const body = await request.json().catch(() => ({}));
    const config = await getNovaTelegramConfig();
    if (!config.botToken || !config.adminChatId) {
      return NextResponse.json(
        { error: "Bot token and admin ID are required" },
        { status: 400 }
      );
    }

    const explicit = String(body.publicBaseUrl || "").trim().replace(/\/+$/, "");
    const baseUrl = explicit || config.publicBaseUrl || deriveBaseUrl(request);
    if (!baseUrl.startsWith("https://")) {
      return NextResponse.json(
        { error: "HTTPS URL is required for the webhook" },
        { status: 400 }
      );
    }

    const secretToken = config.secretToken || generateWebhookSecret();
    const saved = await saveNovaTelegramConfig({
      secretToken,
      ...(explicit && explicit !== config.publicBaseUrl ? { publicBaseUrl: explicit } : {}),
    });

    const webhookUrl = `${baseUrl}${WEBHOOK_PATH}`;
    const apiBase = `https://api.telegram.org/bot${saved.botToken}`;

    const setRes = await fetch(`${apiBase}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: saved.secretToken,
        allowed_updates: ["message"],
        drop_pending_updates: false,
      }),
    });
    const setResult = await setRes.json().catch(() => ({}));
    if (!setResult.ok) {
      return NextResponse.json(
        { error: setResult.description || `setWebhook failed (${setRes.status})` },
        { status: 502 }
      );
    }

    let webhookInfo = null;
    try {
      const infoRes = await fetch(`${apiBase}/getWebhookInfo`, { cache: "no-store" });
      const info = await infoRes.json().catch(() => ({}));
      if (info.ok) webhookInfo = info.result || null;
    } catch { /* optional */ }

    return NextResponse.json({ url: webhookUrl, info: webhookInfo });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Webhook setup failed" }, { status: 500 });
  }
}

// DELETE /api/dashboard/nova/telegram/webhook — unregister the webhook.
export async function DELETE(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const config = await getNovaTelegramConfig();
    if (!config.botToken) {
      return NextResponse.json({ error: "Bot token is not configured" }, { status: 400 });
    }
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/deleteWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    const result = await res.json().catch(() => ({}));
    if (!result.ok) {
      return NextResponse.json(
        { error: result.description || `deleteWebhook failed (${res.status})` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Webhook removal failed" }, { status: 500 });
  }
}
