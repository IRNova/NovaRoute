import { NextResponse } from "next/server";
import { getNovaTelegramConfig } from "@/lib/db/repos/novaRepo.js";
import { processTelegramUpdate } from "@/lib/nova/telegram.js";
import { timingSafeEqualStr } from "@/lib/auth/timingSafe";

export const dynamic = "force-dynamic";

// Public endpoint called by Telegram. NOT behind management auth — requests
// are authenticated with the X-Telegram-Bot-Api-Secret-Token header that
// Telegram attaches to every webhook delivery (secret set via setWebhook).
export async function POST(request) {
  const config = await getNovaTelegramConfig();
  const expected = config?.secretToken;
  const received = request.headers.get("x-telegram-bot-api-secret-token");

  if (!expected || !config.enabled || !timingSafeEqualStr(String(received || ""), String(expected))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  if (update) {
    // Answer Telegram immediately (it retries slow webhooks → duplicates);
    // the multi-agent turn can take minutes and runs in the background.
    void processTelegramUpdate(update).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
