// Thin Telegram Bot API client shared by the bridge and the tools module.
import { getNovaTelegramConfig } from "@/lib/db/repos/novaRepo.js";

const TELEGRAM_API = "https://api.telegram.org";

export async function tgCall(token, method, payload) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error(data.description || `Telegram ${method} failed (${res.status})`);
  }
  return data.result;
}

export async function notifyAdmin(text) {
  try {
    const config = await getNovaTelegramConfig();
    if (!config.botToken || !config.adminChatId) return false;
    await tgCall(config.botToken, "sendMessage", {
      chat_id: config.adminChatId,
      text,
    });
    return true;
  } catch {
    return false;
  }
}
