import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import {
  getNovaTelegramConfig,
  saveNovaTelegramConfig,
} from "@/lib/db/repos/novaRepo.js";
import {
  generateWebhookSecret,
  ensureTelegramPoller,
  isTelegramPollerRunning,
} from "@/lib/nova/telegram.js";

export const dynamic = "force-dynamic";

function maskToken(token) {
  if (!token) return "";
  if (token.length <= 10) return "••••";
  return `${token.slice(0, 6)}••••${token.slice(-4)}`;
}

async function buildStatus(config) {
  const status = { botUsername: null, webhook: null };
  if (!config.botToken) return status;
  const base = `https://api.telegram.org/bot${config.botToken}`;
  try {
    const meRes = await fetch(`${base}/getMe`, { cache: "no-store" });
    const me = await meRes.json().catch(() => ({}));
    if (me.ok) status.botUsername = me.result?.username || null;
  } catch { /* offline — status stays null */ }
  try {
    const hookRes = await fetch(`${base}/getWebhookInfo`, { cache: "no-store" });
    const hook = await hookRes.json().catch(() => ({}));
    if (hook.ok) status.webhook = hook.result || null;
  } catch { /* offline */ }
  return status;
}

// GET /api/dashboard/nova/telegram/config
export async function GET(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const config = await getNovaTelegramConfig();
    const status = await buildStatus(config);
    return NextResponse.json({
      config: {
        botTokenMasked: maskToken(config.botToken),
        hasToken: Boolean(config.botToken),
        adminChatId: config.adminChatId,
        enabled: config.enabled,
        mode: config.mode || "webhook",
        publicBaseUrl: config.publicBaseUrl,
      },
      pollerRunning: isTelegramPollerRunning(),
      ...status,
    });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to load Telegram settings" }, { status: 500 });
  }
}

// PUT /api/dashboard/nova/telegram/config
export async function PUT(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  try {
    const body = await request.json().catch(() => ({}));
    const patch = {};

    if (typeof body.botToken === "string" && body.botToken.trim()) {
      patch.botToken = body.botToken.trim();
    }
    if (body.adminChatId !== undefined) {
      const chatId = String(body.adminChatId).trim();
      if (chatId && !/^-?\d+$/.test(chatId)) {
        return NextResponse.json({ error: "Admin numeric ID must be a number" }, { status: 400 });
      }
      patch.adminChatId = chatId;
    }
    if (body.publicBaseUrl !== undefined) {
      patch.publicBaseUrl = String(body.publicBaseUrl || "").trim().replace(/\/+$/, "");
    }
    if (body.enabled !== undefined) {
      patch.enabled = Boolean(body.enabled);
    }
    if (body.mode !== undefined) {
      patch.mode = body.mode === "polling" ? "polling" : "webhook";
    }

    const current = await getNovaTelegramConfig();
    if (!current.secretToken) {
      patch.secretToken = generateWebhookSecret();
    }

    const saved = await saveNovaTelegramConfig(patch);
    // Kick the poller when polling mode is active; it self-terminates when
    // the config stops matching, so calling it on every save is safe.
    void ensureTelegramPoller().catch(() => {});
    const status = await buildStatus(saved);
    return NextResponse.json({
      config: {
        botTokenMasked: maskToken(saved.botToken),
        hasToken: Boolean(saved.botToken),
        adminChatId: saved.adminChatId,
        enabled: saved.enabled,
        mode: saved.mode || "webhook",
        publicBaseUrl: saved.publicBaseUrl,
      },
      pollerRunning: isTelegramPollerRunning(),
      ...status,
    });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "Failed to save Telegram settings" }, { status: 500 });
  }
}
