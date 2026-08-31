// Telegram bridge: the admin talks to the CEO from Telegram. Only the final
// CEO report is sent back — every internal step (plan, tasks, reviews) is
// persisted by the orchestrator and stays visible in the Nova Bot dashboard.
import { randomBytes } from "node:crypto";
import {
  getNovaTelegramConfig,
  saveNovaTelegramConfig,
  getNovaSessionById,
  getNovaSessions,
  createNovaSession,
} from "@/lib/db/repos/novaRepo.js";
import { runNovaTurn } from "./orchestrator.js";
import { resolveApproval, listApprovals } from "./tools.js";
import { resolveUserbotDraft, renderDraftCard, updateUserbotDraft } from "./userbot.js";
import { resolveIgDraft, updateIgDraft, renderIgDraftCard } from "./instagram.js";
import { transcribe, tts as mediaTts } from "./media.js";
import { getNovaMessages } from "@/lib/db/repos/novaRepo.js";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const mediaKv = makeKv("novaMedia");
import { tgSetReaction } from "./integrations.js";

const TELEGRAM_API = "https://api.telegram.org";
const TELEGRAM_SESSION_TITLE = "Telegram";
const MAX_MESSAGE_LENGTH = 4000;
const CARD_ID_RE = /\u200e?#([a-zA-Z0-9-]{4,})/;

// Cards awaiting an edited text: admin pressed ✏️ on card <id> (msgId = the
// card's own Telegram message so we can re-render it IN PLACE). The next
// plain text from the admin updates the draft — nothing is auto-sent.
const pendingEdits = new Map();

// Long-polling state — lets the bot work WITHOUT a domain/webhook/SSL.
const pollerState = { running: false, offset: 0 };

export function generateWebhookSecret() {
  return randomBytes(24).toString("hex");
}

async function tgCall(token, method, payload) {
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

export async function sendTelegramMessage(chatId, text) {
  const config = await getNovaTelegramConfig();
  if (!config.botToken) throw new Error("Telegram bot token is not configured");
  const content = String(text || "").trim() || "(empty)";
  for (let i = 0; i < content.length; i += MAX_MESSAGE_LENGTH) {
    await tgCall(config.botToken, "sendMessage", {
      chat_id: chatId,
      text: content.slice(i, i + MAX_MESSAGE_LENGTH),
    });
  }
}

// Serialize turns per chat so overlapping messages don't interleave.
const chatLocks = new Map();
function enqueueChat(chatId, job) {
  const prev = chatLocks.get(chatId) || Promise.resolve();
  const next = prev.then(job, job);
  chatLocks.set(chatId, next.finally(() => {
    if (chatLocks.get(chatId) === next) chatLocks.delete(chatId);
  }));
  return next;
}

// ── Voice messages: ویس → متن → پردازش → (اختیاری) پاسخ صوتی ──

async function downloadTgFile(config, fileId) {
  const f = await tgCall(config.botToken, "getFile", { file_id: fileId });
  if (!f?.file_path) throw new Error("getFile failed");
  const url = `${TELEGRAM_API}/file/bot${config.botToken}/${f.file_path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir("/tmp/nova-voice", { recursive: true }).catch(() => {});
  const localPath = `/tmp/nova-voice/${Date.now()}-${fileId.slice(-8)}.ogg`;
  await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  return localPath;
}

async function sendTelegramVoice(chatId, filePath) {
  try {
    const { readFile } = await import("node:fs/promises");
    const buf = await readFile(filePath);
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("voice", new Blob([buf]), "reply.mp3");
    await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendVoice`, { method: "POST", body: form });
  } catch { /* voice reply best-effort */ }
}

async function handleVoiceMessage(config, chatId, msg) {
  const fileId = msg.voice?.file_id || msg.audio?.file_id;
  if (!fileId) return;
  await sendTelegramMessage(chatId, "🎙️ دارم ویس رو گوش می‌دم…");
  try {
    const audioPath = await downloadTgFile(config, fileId);
    const text = String(await transcribe({ audio_path: audioPath }) || "").trim();
    if (!text || text === "(empty transcription)") {
      await sendTelegramMessage(chatId, "🤔 نتونستم ویس رو بفهمم. یه بار دیگه بگو.");
      return;
    }
    // Run the normal company pipeline on the transcript.
    await enqueueChat(chatId, () => handleAdminMessage(config, chatId, text, msg));

    // Optional spoken reply: TTS the latest CEO answer.
    let cfg = {};
    try { cfg = (await mediaKv.get("defaults", {})) || {}; } catch {}
    if (cfg.voiceReply) {
      try {
        const sessionId = config.telegramSessionId;
        const msgs = sessionId ? await getNovaMessages(sessionId) : [];
        const lastAgent = [...msgs].reverse().find((m) => m.role === "agent" && m.agentRole === "ceo");
        const sayText = String(lastAgent?.content || "").slice(0, 3500);
        if (sayText) {
          const r = await mediaTts({ text: sayText });
          const m = String(r || "").match(/(\/tmp\/[^\s]+\.mp3)/);
          if (m) await sendTelegramVoice(chatId, m[1]);
        }
      } catch (e) {
        await sendTelegramMessage(chatId, `⚠️ پاسخ صوتی ناموفق: ${String(e?.message || e).slice(0, 120)}`);
      }
    }
  } catch (e) {
    await sendTelegramMessage(chatId, `⚠️ خطای پردازش ویس: ${String(e?.message || e).slice(0, 150)}`);
  }
}
export async function processTelegramUpdate(update) {
  try {
    const config = await getNovaTelegramConfig();
    if (!config?.enabled || !config.botToken) return;

    // Inline keyboard presses from the userbot approval cards.
    const cb = update?.callback_query;
    if (cb?.data?.startsWith("ub|")) {
      if (String(cb.from?.id) !== String(config.adminChatId)) return;
      const [, action, id] = cb.data.split("|");
      const cardChatId = cb.message?.chat?.id;
      const cardMsgId = cb.message?.message_id;

      // ✏️ → arm edit mode for this card; the admin's next plain text
      // re-renders the SAME card with the new draft. Nothing is sent.
      if (action === "edit" && id) {
        pendingEdits.set(String(config.adminChatId), { id, msgId: cardMsgId });
        tgCall(config.botToken, "answerCallbackQuery", {
          callback_query_id: cb.id,
          text: "✍️ متن جدید را بفرست — تا ✅ نزنی چیزی ارسال نمی‌شود",
        }).catch(() => {});
        sendTelegramMessage(cardChatId, `✍️ متن جدید پیشنهاد #${id} را بفرست (ویرایش روی خود کارت اعمال می‌شود).`).catch(() => {});
        return;
      }
      if (action === "noop") {
        tgCall(config.botToken, "answerCallbackQuery", { callback_query_id: cb.id }).catch(() => {});
        return;
      }

      let result = null;
      let ack = "⚠️ پیش‌نویس پیدا نشد.";
      try {
        result = await resolveUserbotDraft(id, action === "ok" ? "ok" : "no");
        if (result.ok) ack = result.sent ? "✅ ارسال شد." : "❌ رد شد.";
        else if (result.reason === "offline") ack = "⚠️ یوزربات وصل نیست.";
        else if (result.reason === "rate-cap") ack = "⛔️ سقف ارسال ساعتی.";
      } catch (e) {
        ack = `⚠️ ${e?.message || "خطا"}`;
      }
      tgCall(config.botToken, "answerCallbackQuery", { callback_query_id: cb.id, text: ack }).catch(() => {});
      if (result?.ok) {
        // Approved or rejected → remove the card from the BOT chat entirely.
        // Only here; nothing is ever deleted from a customer's chat.
        tgCall(config.botToken, "deleteMessage", {
          chat_id: cardChatId,
          message_id: cardMsgId,
        }).catch(() => {});
        pendingEdits.delete(String(config.adminChatId));
      } else {
        // Failure → keep the card so it can be retried, just show why.
        tgCall(config.botToken, "editMessageReplyMarkup", {
          chat_id: cardChatId,
          message_id: cardMsgId,
          reply_markup: { inline_keyboard: [[{ text: ack.slice(0, 40), callback_data: "ub|noop" }]] },
        }).catch(() => {});
      }
      return;
    }

    // Instagram draft approval cards (ig|ok|id, ig|no|id, ig|edit|id)
    if (cb?.data?.startsWith("ig|")) {
      if (String(cb.from?.id) !== String(config.adminChatId)) return;
      const [, action, id] = cb.data.split("|");
      const cardChatId = cb.message?.chat?.id;
      const cardMsgId = cb.message?.message_id;

      if (action === "edit" && id) {
        pendingEdits.set(String(config.adminChatId), { id, msgId: cardMsgId, channel: "instagram" });
        tgCall(config.botToken, "answerCallbackQuery", {
          callback_query_id: cb.id,
          text: "✍️ متن جدید را بفرست — تا ✅ نزنی چیزی ارسال نمی‌شود",
        }).catch(() => {});
        sendTelegramMessage(cardChatId, `✍️ متن جدید پیشنهاد Instagram #${id} را بفرست (ویرایش روی خود کارت اعمال می‌شود).`).catch(() => {});
        return;
      }
      if (action === "noop") {
        tgCall(config.botToken, "answerCallbackQuery", { callback_query_id: cb.id }).catch(() => {});
        return;
      }

      let result = null;
      let ack = "⚠️ پیش‌نویس پیدا نشد.";
      try {
        result = await resolveIgDraft(id, action === "ok" ? "ok" : "no");
        if (result.ok) ack = result.sent ? "✅ ارسال شد." : "❌ رد شد.";
        else if (result.reason === "rate-cap") ack = "⛔️ سقف ارسال ساعتی.";
        else if (result.reason === "send-failed") ack = `⚠️ خطا در ارسال: ${(result.detail || "").slice(0, 30)}`;
      } catch (e) {
        ack = `⚠️ ${e?.message || "خطا"}`;
      }
      tgCall(config.botToken, "answerCallbackQuery", { callback_query_id: cb.id, text: ack }).catch(() => {});
      if (result?.ok) {
        tgCall(config.botToken, "deleteMessage", {
          chat_id: cardChatId,
          message_id: cardMsgId,
        }).catch(() => {});
        pendingEdits.delete(String(config.adminChatId));
      } else {
        tgCall(config.botToken, "editMessageReplyMarkup", {
          chat_id: cardChatId,
          message_id: cardMsgId,
          reply_markup: { inline_keyboard: [[{ text: ack.slice(0, 40), callback_data: "ig|noop" }]] },
        }).catch(() => {});
      }
      return;
    }

    const message = update?.message;
    if (message && !message.text && (message.voice || message.audio)) {
      const vChatId = String(message.chat?.id || "");
      if (!vChatId || String(config.adminChatId) !== vChatId) return;
      await enqueueChat(vChatId, () => handleVoiceMessage(config, vChatId, message));
      return;
    }
    if (!message?.text) return;
    const chatId = String(message.chat?.id || "");
    if (!chatId || String(config.adminChatId) !== chatId) return;
    tgSetReaction(config.botToken, chatId, message.message_id, "👀").catch(() => {});
    await enqueueChat(chatId, () => handleAdminMessage(config, chatId, String(message.text).trim(), message));
  } catch { /* webhook processing must never throw */ }
}

async function resolveTelegramSession(config) {
  let sessionId = config.telegramSessionId || "";
  if (sessionId) {
    const session = await getNovaSessionById(sessionId);
    if (session) return sessionId;
    sessionId = "";
  }
  const sessions = await getNovaSessions();
  const found = sessions.find((s) => s.title === TELEGRAM_SESSION_TITLE);
  if (found) {
    await saveNovaTelegramConfig({ telegramSessionId: found.id });
    return found.id;
  }
  const created = await createNovaSession(TELEGRAM_SESSION_TITLE);
  await saveNovaTelegramConfig({ telegramSessionId: created.id });
  return created.id;
}

async function handleAdminMessage(config, chatId, text, msg = null) {
  // Slash commands cancel any armed card-edit first.
  if (text.startsWith("/")) pendingEdits.delete(chatId);

  // ── Draft edit-in-place (never auto-sends) ─────────────────────────────
  // Two ways to arm it: press ✏️ on the card (pendingEdits) or simply REPLY
  // to the card with the new text. The typed text UPDATES THE CARD ITSELF;
  // the customer only receives it after ✅ is pressed on the updated card.
  const repliedText = String(msg?.reply_to_message?.text || "");
  const replyRid = msg?.reply_to_message ? repliedText.match(CARD_ID_RE)?.[1] : null;
  const armed = pendingEdits.get(chatId);
  const editTarget = replyRid
    ? { id: replyRid, msgId: msg.reply_to_message.message_id }
    : !text.startsWith("/") && armed
      ? { id: armed.id, msgId: armed.msgId }
      : null;

  if (editTarget && text.trim()) {
    pendingEdits.delete(chatId);
    // Determine channel from armed edit context
    const channel = armed?.channel || "userbot";
    try {
      let upd;
      if (channel === "instagram") {
        upd = await updateIgDraft(editTarget.id, text);
        if (upd.ok && editTarget.msgId) {
          tgCall(config.botToken, "editMessageText", {
            chat_id: chatId,
            message_id: editTarget.msgId,
            text: renderIgDraftCard(upd.item),
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ ارسال", callback_data: `ig|ok|${upd.item.id}` },
                  { text: "❌ رد", callback_data: `ig|no|${upd.item.id}` },
                ],
                [{ text: "✏️ ویرایش دوباره", callback_data: `ig|edit|${upd.item.id}` }],
              ],
            },
          }).catch(() => {});
          await sendTelegramMessage(chatId, "✏️ روی کارت Instagram اعمال شد — بررسی کن؛ ارسال فقط با دکمهٔ ✅.");
          return;
        }
      } else {
        upd = await updateUserbotDraft(editTarget.id, text);
      }
      if (upd.ok) {
        if (editTarget.msgId) {
          // Re-render the SAME card in place with the edited draft.
          tgCall(config.botToken, "editMessageText", {
            chat_id: chatId,
            message_id: editTarget.msgId,
            text: renderDraftCard(upd.item),
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ ارسال", callback_data: `ub|ok|${upd.item.id}` },
                  { text: "❌ رد", callback_data: `ub|no|${upd.item.id}` },
                ],
                [{ text: "✏️ ویرایش دوباره", callback_data: `ub|edit|${upd.item.id}` }],
              ],
            },
          }).catch(() => {});
          await sendTelegramMessage(chatId, "✏️ روی کارت اعمال شد — بررسی کن؛ ارسال فقط با دکمهٔ ✅.");
        } else {
          await sendTelegramMessage(
            chatId,
            `✏️ متن به‌روز شد:\n\n${renderDraftCard(upd.item)}\n\nارسال فقط با دکمهٔ ✅ روی کارت اصلی.`
          );
        }
      } else if (upd.reason === "not-found") {
        await sendTelegramMessage(chatId, `⚠️ پیش‌نویس ${editTarget.id} پیدا نشد (شاید قبلاً ارسال/رد شده).`);
      } else {
        await sendTelegramMessage(chatId, "⚠️ متن خالی بود.");
      }
    } catch (error) {
      await sendTelegramMessage(chatId, `⚠️ ${error?.message || "خطا در ویرایش"}`);
    }
    return;
  }

  // Userbot draft direct-send: /rep <id> <edited reply> (power-user shortcut)
  const repMatch = text.match(/^\/rep\s+([a-zA-Z0-9-]{4,})\s+([\s\S]+)$/i);
  if (repMatch) {
    try {
      const result = await resolveUserbotDraft(repMatch[1], "ok", repMatch[2].trim());
      await sendTelegramMessage(
        chatId,
        result.ok
          ? `✅ پاسخ ویرایش‌شده ارسال شد.`
          : result.reason === "offline"
            ? "⚠️ یوزربات وصل نیست؛ اول از پنل اتصال را چک کن."
            : `⚠️ پیش‌نویس ${repMatch[1]} پیدا نشد یا خالی است.`
      );
    } catch (error) {
      await sendTelegramMessage(chatId, `⚠️ ${error?.message || "خطا در ارسال"}`);
    }
    return;
  }

  // Instagram draft direct-send: /ig-rep <id> <edited reply>
  const igRepMatch = text.match(/^\/ig-rep\s+([a-zA-Z0-9-]{4,})\s+([\s\S]+)$/i);
  if (igRepMatch) {
    try {
      const result = await resolveIgDraft(igRepMatch[1], "ok", igRepMatch[2].trim());
      await sendTelegramMessage(
        chatId,
        result.ok
          ? `✅ پاسخ Instagram ارسال شد.`
          : result.reason === "rate-cap"
            ? "⛔️ سقف ارسال ساعتی."
            : `⚠️ پیش‌نویس Instagram ${igRepMatch[1]} پیدا نشد یا خالی است.`
      );
    } catch (error) {
      await sendTelegramMessage(chatId, `⚠️ ${error?.message || "خطا در ارسال"}`);
    }
    return;
  }

  // Approval commands (/ok <id>, /no <id>) are intercepted BEFORE any chat
  // turn so they never reach the CEO.
  const approvalMatch = text.match(/^\/?(ok|yes|approve|no|deny)\s+([a-zA-Z0-9-]{4,})$/i);
  if (approvalMatch) {
    const approved = /^(ok|yes|approve)$/i.test(approvalMatch[1]);
    const id = approvalMatch[2];
    try {
      const resolved = await resolveApproval(id, approved, "telegram");
      await sendTelegramMessage(
        chatId,
        resolved
          ? approved
            ? `✅ دستور ${id} تأیید شد — در حال اجرا...`
            : `❌ دستور ${id} رد شد.`
          : `⚠️ درخواست ${id} پیدا نشد (احتمالاً قبلاً تصمیم‌گیری شده یا منقضی شده).`
      );
    } catch (error) {
      await sendTelegramMessage(chatId, `⚠️ ${error?.message || "Failed to resolve approval"}`);
    }
    return;
  }
  if (/^\/?(pending|درخواست‌?ها)$/i.test(text.trim())) {
    try {
      const { pending } = await listApprovals();
      if (!pending.length) {
        await sendTelegramMessage(chatId, "درخواست اجرایی در انتظار تأیید نیست.");
      } else {
        const lines = pending.map((p) => `• /ok ${p.id} — \`${p.command.slice(0, 200)}\` (${p.agentName})`);
        await sendTelegramMessage(chatId, `⏳ در انتظار تأیید:\n${lines.join("\n")}`);
      }
    } catch (error) {
      await sendTelegramMessage(chatId, `⚠️ ${error?.message || "Failed to list approvals"}`);
    }
    return;
  }

  try {
    tgCall(config.botToken, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});

    const sessionId = await resolveTelegramSession(config);

    // The last report/error message of the turn IS the final answer.
    let finalText = null;
    await runNovaTurn({
      sessionId,
      text,
      onEvent: (event) => {
        if (
          event.type === "message" &&
          event.message &&
          (event.message.type === "report" || event.message.type === "error")
        ) {
          finalText = event.message.content;
        }
      },
    });

    await sendTelegramMessage(chatId, finalText || "No answer was produced.");
  } catch (error) {
    try {
      await sendTelegramMessage(chatId, `⚠️ ${error?.message || "Unexpected error"}`);
    } catch { /* delivery of the error itself failed — nothing more to do */ }
  }
}

// ---------------------------------------------------------------------------
// Long-polling mode (getUpdates) — no domain, no SSL, works behind NAT.
// The loop self-terminates whenever the config stops matching (disabled,
// token changed, or mode switched back to webhook).
// ---------------------------------------------------------------------------

export function isTelegramPollerRunning() {
  return pollerState.running;
}

export async function ensureTelegramPoller() {
  const config = await getNovaTelegramConfig();
  if (!config.enabled || !config.botToken || config.mode !== "polling") return;
  if (pollerState.running) return;
  pollerState.running = true;
  pollLoop(config.botToken).catch(() => { pollerState.running = false; });
}

async function pollLoop(token) {
  let backoffMs = 1000;
  try {
    while (true) {
      const config = await getNovaTelegramConfig();
      if (!config.enabled || config.botToken !== token || config.mode !== "polling") break;

      try {
        const res = await fetch(`${TELEGRAM_API}/bot${token}/getUpdates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offset: pollerState.offset,
            timeout: 25,
            allowed_updates: ["message", "callback_query"],
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!data.ok) {
          // 409 Conflict = a webhook is still registered; polling requires none.
          if (data.error_code === 409) {
            await tgCall(token, "deleteWebhook", { drop_pending_updates: false }).catch(() => {});
          }
          throw new Error(data.description || `getUpdates failed (${res.status})`);
        }
        backoffMs = 1000;
        for (const update of data.result || []) {
          pollerState.offset = Math.max(pollerState.offset, Number(update.update_id || 0) + 1);
          await processTelegramUpdate(update);
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        backoffMs = Math.min(backoffMs * 2, 30000);
      }
    }
  } finally {
    pollerState.running = false;
  }
}
