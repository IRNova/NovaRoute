// Instagram DM Bridge — پاسخ خودکار AI به دایرکت‌های اینستاگرام
//
// الگوی مشابه userbot.js — draft cards با تأیید روی ربات تلگرام
// Flow: DM میاد → AI جواب آماده می‌کنه → کارت draft با ✅❌ روی تلگرام → تأیید → ارسال

import { randomUUID } from "node:crypto";
import { makeKv } from "@/lib/db/helpers/kvStore.js";
import {
  getNovaTelegramConfig,
  getNovaInstagramConfig,
  saveNovaInstagramConfig,
} from "@/lib/db/repos/novaRepo.js";
import { generateWithAgent } from "./orchestrator.js";
import { tgCall } from "./telegramApi.js";

const kv = makeKv("novaInstagramDm");

const IG_API = "https://graph.facebook.com/v21.0";
const DRAFTS_LIMIT = 60;
const HISTORY_LIMIT = 60;
const OUTGOING_HOURLY_CAP = 30;
const MAX_MESSAGE_LENGTH = 2000;

let outCounter = { hour: new Date().getHours(), sent: 0 };

function outAllowed() {
  const h = new Date().getHours();
  if (outCounter.hour !== h) outCounter = { hour: h, sent: 0 };
  return outCounter.sent < OUTGOING_HOURLY_CAP;
}

function bumpOutgoing() {
  const h = new Date().getHours();
  if (outCounter.hour !== h) outCounter = { hour: h, sent: 0 };
  outCounter.sent += 1;
}

async function audit(entry) {
  try {
    const log = (await kv.get("log", [])) || [];
    log.unshift({ at: new Date().toISOString(), ...entry });
    await kv.set("log", log.slice(0, 120));
  } catch {}
}

// ── Instagram Graph API client ──

async function igCall(endpoint, method = "GET", body = null) {
  const config = await getNovaInstagramConfig();
  if (!config.pageAccessToken) throw new Error("Instagram page access token not configured");
  const url = `${IG_API}/${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${config.pageAccessToken}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error.message || `Instagram API error (${res.status})`);
  return data;
}

// ── ارسال پیام متنی به اینستاگرام ──

export async function sendInstagramMessage(userId, text) {
  const config = await getNovaInstagramConfig();
  if (!config.pageAccessToken) throw new Error("Instagram page access token not configured");
  if (!config.pageId) throw new Error("Instagram page ID not configured");

  const content = String(text || "").trim() || "(empty)";
  for (let i = 0; i < content.length; i += MAX_MESSAGE_LENGTH) {
    await igCall(`${config.pageId}/messages`, "POST", {
      recipient: { id: userId },
      messaging_type: "RESPONSE",
      message: { text: content.slice(i, i + MAX_MESSAGE_LENGTH) },
    });
  }
  bumpOutgoing();
}

// ── ارسال تصویر به اینستاگرام ──

export async function sendInstagramImage(userId, imageUrl, caption = "") {
  const config = await getNovaInstagramConfig();
  if (!config.pageAccessToken) throw new Error("Instagram page access token not configured");
  if (!config.pageId) throw new Error("Instagram page ID not configured");

  const payload = {
    recipient: { id: userId },
    messaging_type: "RESPONSE",
    message: {
      attachment: { type: "image", payload: { url: imageUrl } },
    },
  };
  if (caption) payload.message.caption = caption;
  await igCall(`${config.pageId}/messages`, "POST", payload);
  bumpOutgoing();
}

// ── Webhook verification (GET handler) ──

export function verifyIgWebhook(mode, token, verifyToken) {
  if (mode === "subscribe" && token === verifyToken) {
    return true;
  }
  return false;
}

// ── Webhook signature verification (X-Hub-Signature-256) ──

export async function verifyIgSignature(rawBody, signature) {
  const config = await getNovaInstagramConfig();
  const appSecret = config.appSecret;
  if (!appSecret || !signature) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = "sha256=" + createHmac("sha256", appSecret)
    .update(typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody))
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Process incoming webhook event ──

export async function processInstagramUpdate(event) {
  try {
    const config = await getNovaInstagramConfig();
    if (!config.enabled || !config.pageAccessToken) return;

    for (const entry of event.entry || []) {
      for (const messaging of entry.messaging || []) {
        // Only process incoming messages (not echoes)
        if (messaging.message && !messaging.message.is_echo) {
          await handleIgDm(config, messaging);
        }
      }
    }
  } catch (error) {
    console.error("[Instagram] Webhook processing error:", error.message);
  }
}

// ── Chat lock — serialize turns per sender ──

const chatLocks = new Map();
function enqueueChat(senderId, job) {
  const prev = chatLocks.get(senderId) || Promise.resolve();
  const next = prev.then(job, job);
  chatLocks.set(senderId, next.finally(() => {
    if (chatLocks.get(senderId) === next) chatLocks.delete(senderId);
  }));
  return next;
}

// ── پردازش DM اینستاگرام ──

async function handleIgDm(config, messaging) {
  const senderId = messaging.sender?.id;
  const message = messaging.message;
  if (!senderId || !message) return;

  // Only process text messages for now
  const text = String(message.text || "").trim();
  if (!text) return;

  // Skip admin's own messages
  if (config.adminIgUserId && senderId === config.adminIgUserId) return;

  // Check blacklist
  if ((config.blacklist || []).some((b) => String(b).trim() === senderId)) return;

  // Get sender info from Instagram
  let senderName = `user-${senderId}`;
  try {
    const profile = await igCall(senderId);
    if (profile.name) senderName = profile.name;
  } catch { /* profile fetch best-effort */ }

  await enqueueChat(senderId, () =>
    processDmAndDraft(config, senderId, senderName, text)
  );
}

// ── Generate AI draft and send to admin for approval ──

async function processDmAndDraft(config, senderId, senderName, text) {
  const contacts = (await kv.get("contacts", {})) || {};
  const state = contacts[senderId] || {
    name: senderName,
    approved: 0,
    total: 0,
    history: [],
    firstAt: new Date().toISOString(),
  };
  state.name = senderName;
  const isFirstContact = state.total === 0;

  // Build conversation history
  const historyLines = (state.history || [])
    .slice(-8)
    .map((h) => `${h.role === "me" ? "YOU(replied)" : senderName}: ${String(h.text).slice(0, 300)}`)
    .join("\n");

  const systemPrompt = [
    "تو پاسخگوی دایرکت‌های اینستاگرام یک کسب‌وکار هستی.",
    config.behaviorPrompt || "",
    "فقط متن ساده بنویس — از ایموجی زیاد استفاده نکن.",
    "کوتاه و طبیعی بنویس، مثل یک ادمین واقعی.",
    "فارسی طبیعی بنویس، نه کتابی و اداری.",
    isFirstContact ? "با یک سلام کوتاه و صمیمی شروع کن." : "",
    historyLines ? `تاریخچه مکالمه:\n${historyLines}` : "",
  ].filter(Boolean).join("\n");

  const userPrompt = `پیام جدید از ${senderName} در اینستاگرام:\n"""${text}"""\n\nجواب کوتاه و مناسب بنویس:`;

  let draft = "";
  try {
    const { agent } = await getIgAgent();
    if (!agent) {
      await notifyAdminIg(`⚠️ هیچ عامل فعالی برای پاسخگویی اینستاگرام تنظیم نشده.`);
      return;
    }
    draft = await generateWithAgent(agent, systemPrompt, userPrompt);
  } catch (error) {
    await audit({ kind: "model-error", from: senderName, detail: String(error?.message).slice(0, 200) });
    return;
  }

  if (!draft) return;

  // Check auto-approve threshold
  const auto = config.autoApproveAfterN > 0 && state.approved >= config.autoApproveAfterN;
  if (auto && config.alwaysReply) {
    // Auto-send without approval
    try {
      await sendInstagramMessage(senderId, draft);
      state.total += 1;
      state.history = [...(state.history || []),
        { role: "them", text, at: nowIso() },
        { role: "me", text: draft, at: nowIso() },
      ].slice(-HISTORY_LIMIT);
      contacts[senderId] = state;
      await kv.set("contacts", contacts);
      await audit({ kind: "auto-sent", from: senderName, text: text.slice(0, 120), reply: draft.slice(0, 160) });
      await notifyAdminIg(`🤖 خودکار به ${senderName} پاسخ دادم:\n«آنها»: ${text.slice(0, 150)}\n«من»: ${draft.slice(0, 200)}`);
      return;
    } catch (error) {
      await audit({ kind: "auto-send-failed", from: senderName, detail: String(error?.message).slice(0, 200) });
    }
  }

  // Store draft for admin approval
  const drafts = (await kv.get("pendingDrafts", [])) || [];
  const draftItem = {
    id: randomUUID().slice(0, 8),
    senderId,
    name: senderName,
    incoming: text.slice(0, 800),
    draft: draft.slice(0, 3500),
    createdAt: new Date().toISOString(),
    channel: "instagram",
  };
  drafts.push(draftItem);
  while (drafts.length > DRAFTS_LIMIT) drafts.shift();
  await kv.set("pendingDrafts", drafts);

  // Send draft card to admin via Telegram bot
  try {
    const tgConfig = await getNovaTelegramConfig();
    if (!tgConfig.botToken || !tgConfig.adminChatId) {
      await notifyAdminIg(`📩 پیام از Instagram (${senderName}) نیاز به تأیید دارد ولی ربات تلگرام وصل نیست.\nپیشنهاد: ${draft.slice(0, 400)}`);
      return;
    }

    await tgCall(tgConfig.botToken, "sendMessage", {
      chat_id: tgConfig.adminChatId,
      text: renderIgDraftCard(draftItem),
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ ارسال", callback_data: `ig|ok|${draftItem.id}` },
            { text: "❌ رد", callback_data: `ig|no|${draftItem.id}` },
          ],
          [{ text: "✏️ ویرایش متن", callback_data: `ig|edit|${draftItem.id}` }],
        ],
      },
    });
  } catch (error) {
    await notifyAdminIg(`📩 پیام از Instagram (${senderName}) نیاز به تأیید دارد ولی پل ربات در دسترس نیست.\nبرای ارسال: /ig-rep ${draftItem.id} <متن>\nپیشنهاد: ${draft.slice(0, 400)}`);
  }
  await audit({ kind: "draft", from: senderName, text: text.slice(0, 120) });
}

// ── Render draft card for admin ──

export function renderIgDraftCard(item) {
  return [
    `📩 پیام جدید از Instagram — ${item.name}`,
    ``,
    `«${String(item.incoming || "").slice(0, 600)}»`,
    ``,
    `✍️ پیشنهاد پاسخ:`,
    `«${String(item.draft || "").slice(0, 3500)}»`,
    ``,
    `✅ ارسال / ❌ رد با دکمه‌ها — ✏️ یا ریپلای روی کارت برای ویرایش (ارسال فقط با ✅)`,
    `\u200e#${item.id}`,
  ].join("\n");
}

// ── Resolve draft (called from telegram.js bridge) ──

export async function resolveIgDraft(id, action, editedText = null) {
  const drafts = (await kv.get("pendingDrafts", [])) || [];
  const idx = drafts.findIndex((d) => d.id === id);
  if (idx === -1) return { ok: false, reason: "not-found" };

  const item = drafts[idx];

  if (action === "no") {
    drafts.splice(idx, 1);
    await kv.set("pendingDrafts", drafts);
    await audit({ kind: "rejected", id });
    return { ok: true, sent: false };
  }

  const finalText = String(editedText ?? item.draft ?? "").trim();
  if (!finalText) return { ok: false, reason: "empty" };

  if (!outAllowed()) {
    await notifyAdminIg("⛔️ سقف ارسال ساعتی پر شد؛ ارسال انجام نشد.");
    return { ok: false, reason: "rate-cap" };
  }

  try {
    await sendInstagramMessage(item.senderId, finalText);
    bumpOutgoing();
  } catch (error) {
    await audit({ kind: "send-failed", id, detail: String(error?.message).slice(0, 200) });
    return { ok: false, reason: "send-failed", detail: error?.message };
  }

  drafts.splice(idx, 1);
  await kv.set("pendingDrafts", drafts);

  // Update contact history
  const contacts = (await kv.get("contacts", {})) || {};
  const state = contacts[item.senderId] || { name: item.name, approved: 0, total: 0, history: [] };
  state.approved += 1;
  state.total += 1;
  state.history = [...(state.history || []),
    { role: "them", text: item.incoming, at: nowIso() },
    { role: "me", text: finalText, at: nowIso() },
  ].slice(-HISTORY_LIMIT);
  contacts[item.senderId] = state;
  await kv.set("contacts", contacts);

  await audit({ kind: "approved", id, from: item.name, text: item.incoming.slice(0, 100), reply: finalText.slice(0, 100) });
  return { ok: true, sent: true };
}

// ── Update draft text (for edit-in-place from telegram bridge) ──

export async function updateIgDraft(id, newText) {
  const drafts = (await kv.get("pendingDrafts", [])) || [];
  const item = drafts.find((d) => d.id === id);
  if (!item) return { ok: false, reason: "not-found" };
  const t = String(newText || "").trim();
  if (!t) return { ok: false, reason: "empty" };
  item.draft = t.slice(0, 3500);
  await kv.set("pendingDrafts", drafts);
  await audit({ kind: "draft-edited", id });
  return { ok: true, item };
}

// ── Get active agent for Instagram ──

async function getIgAgent() {
  try {
    const { getNovaAgentsByRole } = await import("@/lib/db/repos/novaRepo.js");
    const employees = (await getNovaAgentsByRole("employee")).filter((a) => a.status === "active");
    const agent = employees[0] || (await getNovaAgentsByRole("ceo")).find((a) => a.status === "active");
    return { agent: agent || null };
  } catch {
    return { agent: null };
  }
}

// ── Notify admin via Telegram ──

async function notifyAdminIg(text) {
  try {
    const tgConfig = await getNovaTelegramConfig();
    if (!tgConfig.botToken || !tgConfig.adminChatId) return false;
    await tgCall(tgConfig.botToken, "sendMessage", {
      chat_id: tgConfig.adminChatId,
      text,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Get pending drafts count ──

export async function getIgPendingDraftsCount() {
  const drafts = (await kv.get("pendingDrafts", [])) || [];
  return drafts.length;
}

// ── Get recent log ──

export async function getIgLog(limit = 40) {
  const log = (await kv.get("log", [])) || [];
  return log.slice(0, limit);
}

// ── Get contact history ──

export async function getIgContacts() {
  return (await kv.get("contacts", {})) || {};
}

function nowIso() {
  return new Date().toISOString();
}
