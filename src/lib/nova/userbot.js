// Nova userbot — answers the admin's personal Telegram account (MTProto).
//
// HARD RULES baked into this module:
//   - Nothing is ever sent without approval until a contact crosses the
//     auto-approve threshold (autoApproveAfterN approved replies).
//   - Model failure => TOTAL silence toward the customer; only the admin is
//     notified. No error text is ever delivered to end users.
//   - Saved contacts (optional) and blacklisted users are never touched.
//   - Only messages newer than `activeSince` are processed.
//   - Groups are ignored unless explicitly enabled, and even then only when
//     the account is mentioned or the message replies to one of ours.
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { makeKv } from "@/lib/db/helpers/kvStore.js";
import { getNovaAgentById, getNovaAgents, getNovaTelegramConfig } from "@/lib/db/repos/novaRepo.js";
import { generateWithAgent } from "./orchestrator.js";
import { tgCall, notifyAdmin } from "./telegramApi.js";

const kv = makeKv("novaUserbot");

const DEFAULT_CONFIG = {
  enabled: false,
  apiId: "",
  apiHash: "",
  sessionString: "",
  agentId: "",
  behaviorPrompt: "",
  timeZone: "Asia/Tehran",
  greetingEnabled: true,
  greetingMorning: "درود، صبح‌تون بخیر 🌤",
  greetingNoon: "درود، روز‌تون بخیر ☀️",
  greetingEvening: "درود، شب‌تون بخیر 🌙",
  greetingDawn: "درود، بامداد‌تون بخیر 🌌",
  allowGroups: false,
  allowChannels: false,
  allowBots: false,
  skipSavedContacts: true,
  backlogEnabled: true,
  backlogIntervalSec: 60,
  backlogDays: 30,
  blacklist: [],
  autoApproveAfterN: 0,
  activeSince: null,
};

const HISTORY_LIMIT = 60;
const OUTGOING_HOURLY_CAP = 30;
const DRAFTS_LIMIT = 60;
const LOG_LIMIT = 120;

// ---------------------------------------------------------------------------
// runtime state
// ---------------------------------------------------------------------------

let clientPromise = null;
let tempLogin = null; // { client, phoneNumber, phoneCodeHash }
let savedIdsCache = { at: 0, ids: [] };
let outCounter = { hour: new Date().getHours(), sent: 0 };
const chains = new Map(); // chatId -> promise chain
const ownSendIds = new Set(); // message ids the USERBOT sent — excluded from owner-voice capture
let backlogTimer = null;
const backlogAttempts = new Map(); // chatId -> ts of last failed draft attempt (cooldown)
const GREET_COOLDOWN_MS = 6 * 3_600_000; // no repeat greeting within ~6h

function chain(chatId, fn) {
  const prev = chains.get(chatId) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  chains.set(chatId, next);
  return next;
}

function outAllowed() {
  const h = new Date().getHours();
  if (outCounter.hour !== h) outCounter = { hour: h, sent: 0 };
  return outCounter.sent < OUTGOING_HOURLY_CAP;
}

async function audit(entry) {
  try {
    const log = (await kv.get("log", [])) || [];
    log.unshift({ at: new Date().toISOString(), ...entry });
    await kv.set("log", log.slice(0, LOG_LIMIT));
  } catch {}
}

async function bumpOutgoing() {
  const h = new Date().getHours();
  if (outCounter.hour !== h) outCounter = { hour: h, sent: 0 };
  outCounter.sent += 1;
}

// ---------------------------------------------------------------------------
// security layer (second key, independent of the dashboard password)
// ---------------------------------------------------------------------------

export async function hasSecurityKey() {
  return Boolean(await kv.get("secHash"));
}

export async function setSecurityKey(newKey, currentKey) {
  if (!newKey || typeof newKey !== "string" || newKey.length < 6) {
    throw new Error("Security key must be at least 6 characters");
  }
  if (await hasSecurityKey()) {
    if (!(await verifySecurityKey(currentKey))) {
      throw new Error("Current security key is required to change it");
    }
  }
  await kv.set("secHash", await bcrypt.hash(newKey, 10));
  return true;
}

export async function verifySecurityKey(key) {
  const hash = await kv.get("secHash");
  if (!hash || typeof key !== "string" || !key) return false;
  return bcrypt.compare(key, hash);
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

function maskConfig(c) {
  return {
    enabled: c.enabled,
    connected: Boolean(c.sessionString),
    apiIdSet: Boolean(c.apiId),
    apiHashMasked: c.apiHash ? `${c.apiHash.slice(0, 2)}••••${c.apiHash.slice(-4)}` : "",
    agentId: c.agentId,
    behaviorPrompt: c.behaviorPrompt,
    timeZone: c.timeZone,
    greetingEnabled: c.greetingEnabled,
    greetingMorning: c.greetingMorning,
    greetingNoon: c.greetingNoon,
    greetingEvening: c.greetingEvening,
    greetingDawn: c.greetingDawn,
    allowGroups: c.allowGroups,
    allowChannels: c.allowChannels,
    allowBots: c.allowBots,
    skipSavedContacts: c.skipSavedContacts,
    backlogEnabled: c.backlogEnabled,
    backlogIntervalSec: c.backlogIntervalSec,
    backlogDays: c.backlogDays,
    blacklist: c.blacklist,
    autoApproveAfterN: c.autoApproveAfterN,
    activeSince: c.activeSince,
  };
}

export async function getStatus() {
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  // Transparent auto-reconnect after deploys/restarts — the saved session
  // means nobody should ever face the login screen twice on the same machine.
  if (config.enabled && config.apiId && config.apiHash && config.sessionString && !isRunning()) {
    ensureUserbot().catch(async (e) => {
      if (await handleAuthFailure(e).catch(() => false)) return;
      await audit({ kind: "autoconnect-failed", detail: String(e?.message || e).slice(0, 200) });
    });
  }
  const contacts = (await kv.get("contacts", {})) || {};
  const pending = ((await kv.get("pendingDrafts", [])) || []).length;
  const log = ((await kv.get("log", [])) || []).slice(0, 40);
  return {
    configured: Boolean(config.apiId && config.apiHash && config.sessionString),
    running: isRunning(),
    loginStage: tempLogin ? tempLogin.stage : null,
    config: maskConfig(config),
    stats: { contactsTracked: Object.keys(contacts).length, pendingDrafts: pending },
    recentLog: log,
  };
}

export async function saveConfig(patch) {
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  const allowed = [
    "enabled", "agentId", "behaviorPrompt", "timeZone",
    "greetingEnabled", "greetingMorning", "greetingNoon", "greetingEvening", "greetingDawn",
    "allowGroups", "allowChannels", "allowBots", "skipSavedContacts",
    "backlogEnabled", "backlogIntervalSec", "backlogDays",
    "blacklist", "autoApproveAfterN",
  ];
  for (const k of allowed) {
    if (patch[k] !== undefined) config[k] = patch[k];
  }
  // Credentials are written through dedicated actions, never via generic PATCH.
  await kv.set("config", config);
  if (patch.enabled !== undefined) {
    if (patch.enabled) await ensureUserbot();
    else await stopUserbot();
  }
  return maskConfig(config);
}

export async function saveCredentials({ apiId, apiHash }) {
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  if (apiId !== undefined && apiId !== "") config.apiId = String(apiId).replace(/\D/g, "");
  if (apiHash !== undefined && apiHash !== "") config.apiHash = String(apiHash).trim();
  await kv.set("config", config);
  return maskConfig(config);
}

// ---------------------------------------------------------------------------
// knowledge base — two kinds:
//   qa  : short verified question/answer pairs
//   doc : large free-form documents (company info, catalogs, policies…).
//         Stored whole (up to 100k chars); retrieved as best-matching chunks.
// ---------------------------------------------------------------------------

export async function listKb() {
  return (await kv.get("kb", [])) || [];
}

export async function upsertKb(entry) {
  const kb = (await kv.get("kb", [])) || [];
  const kind = entry.kind === "doc" ? "doc" : "qa";
  const item = { id: entry.id || randomUUID().slice(0, 8), kind, pinned: Boolean(entry.pinned) };
  if (kind === "doc") {
    item.title = String(entry.title || "").trim().slice(0, 200);
    item.content = String(entry.content || "").trim().slice(0, 100_000);
    if (!item.content) throw new Error("Document text is required");
    if (!item.title) item.title = item.content.slice(0, 40);
  } else {
    item.q = String(entry.q || "").trim().slice(0, 300);
    item.a = String(entry.a || "").trim().slice(0, 4000);
    if (!item.q || !item.a) throw new Error("Question and answer are required");
  }
  const idx = kb.findIndex((e) => e.id === item.id);
  if (idx >= 0) kb[idx] = item; else kb.push(item);
  await kv.set("kb", kb.slice(0, 300));
  return kb;
}

export async function deleteKb(id) {
  const kb = ((await kv.get("kb", [])) || []).filter((e) => e.id !== id);
  await kv.set("kb", kb);
  return kb;
}

// ---------------------------------------------------------------------------
// MTProto lifecycle
// ---------------------------------------------------------------------------

async function loadTelegramLib() {
  try {
    const telegram = await import("telegram");
    const sessions = await import("telegram/sessions/index.js");
    const events = await import("telegram/events/index.js");
    return { TelegramClient: telegram.TelegramClient, Api: telegram.Api, StringSession: sessions.StringSession, NewMessage: events.NewMessage };
  } catch {
    throw new Error("GramJS is not installed. Run: npm install telegram");
  }
}

export function isRunning() {
  return Boolean(clientPromise);
}

export async function stopUserbot() {
  stopBacklogLoop();
  if (!clientPromise) return;
  try {
    const client = await clientPromise;
    await client.disconnect();
  } catch {}
  clientPromise = null;
}

// A revoked/expired authorization must NOT leave the bot half-alive (events
// silently dead, scans failing 401). Detect it, clean up, and force the
// login screen so the admin sees exactly what happened.
async function handleAuthFailure(error) {
  const msg = String(error?.message || error?.errorMessage || "");
  if (!/AUTH_KEY_UNREGISTERED|AUTH_KEY_INVALID|AUTH_KEY_DUPLICATED|SESSION_REVOKED|USER_DEACTIVATED/i.test(msg)) return false;
  await audit({ kind: "session-dead", detail: msg.slice(0, 200) });
  stopBacklogLoop();
  try {
    const client = clientPromise ? await clientPromise : null;
    if (client) await client.disconnect();
  } catch {}
  clientPromise = null;
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  config.sessionString = "";
  config.enabled = false;
  await kv.set("config", config);
  await notifyAdmin("🚨 سشن تلگرام باطل شده (AUTH_KEY_UNREGISTERED).\nاحتمالاً از اکانت، «Terminate all other sessions» خورده یا تلگرام آن را باطل کرده.\nاز پنل دوباره وارد شو تا فعال شود.");
  return true;
}

export async function ensureUserbot() {
  if (clientPromise) return true;
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  if (!config.enabled || !config.apiId || !config.apiHash || !config.sessionString) return false;

  clientPromise = (async () => {
    const { TelegramClient, StringSession } = await loadTelegramLib();
    const client = new TelegramClient(
      new StringSession(config.sessionString),
      Number(config.apiId),
      config.apiHash,
      { connectionRetries: 5 }
    );
    await client.connect();
    await cacheOwnId(client);
    const { NewMessage } = await loadTelegramLib();
    client.addEventHandler((event) => {
      chain(event.chatId?.toString?.() || "x", () =>
        handleIncoming(client, event).catch(async (e) => {
          if (await handleAuthFailure(e)) return;
          await audit({ kind: "error", detail: String(e?.message || e).slice(0, 300) });
        })
      );
    }, new NewMessage({}));
    await audit({ kind: "started" });
    startBacklogLoop();
    return client;
  })().catch(async (e) => {
    clientPromise = null;
    await audit({ kind: "connect-failed", detail: String(e?.message || e).slice(0, 300) });
    throw e;
  });
  return clientPromise.then(() => true);
}

// --- interactive login -------------------------------------------------------

export async function loginSendCode(phoneNumber) {
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  if (!config.apiId || !config.apiHash) throw new Error("Enter api_id and api_hash first");
  const { TelegramClient, StringSession } = await loadTelegramLib();
  const client = new TelegramClient(new StringSession(""), Number(config.apiId), config.apiHash, { connectionRetries: 3 });
  await client.connect();
  const result = await client.sendCode({ apiId: Number(config.apiId), apiHash: config.apiHash }, String(phoneNumber).trim());
  tempLogin = { stage: "awaiting-code", client, phoneNumber: String(phoneNumber).trim(), phoneCodeHash: result.phoneCodeHash };
  return { stage: tempLogin.stage, hint: result.codeSettings?.hint || "" };
}

export async function loginSignIn(code) {
  if (!tempLogin) throw new Error("Request a login code first");
  // Single-shot RPC on purpose: client.signInUser() retries forever through
  // its onError loop on bad codes and pegs the CPU, wedging the whole server.
  const { Api } = await loadTelegramLib();
  try {
    await tempLogin.client.invoke(
      new Api.auth.SignIn({
        phoneNumber: tempLogin.phoneNumber,
        phoneCodeHash: tempLogin.phoneCodeHash,
        phoneCode: String(code).trim(),
      })
    );
  } catch (e) {
    const msg = String(e?.message || e);
    if (/SESSION_PASSWORD_NEEDED/i.test(msg) || e?.errorMessage === "SESSION_PASSWORD_NEEDED") {
      tempLogin.stage = "awaiting-password";
      return { stage: tempLogin.stage };
    }
    if (/PHONE_CODE_INVALID/i.test(msg)) throw new Error("کد واردشده اشتباه است");
    if (/PHONE_CODE_EXPIRED/i.test(msg)) throw new Error("کد منقضی شده — دوباره «ارسال کد» بزن");
    if (/PHONE_NUMBER_UNOCCUPIED/i.test(msg)) throw new Error("این شماره اکانت تلگرام ندارد");
    if (/FLOOD_WAIT/i.test(msg)) throw new Error("تلگرام موقتاً محدود کرده؛ چند دقیقه بعد امتحان کن");
    throw e;
  }
  return finishLogin();
}

export async function loginPassword(password) {
  if (!tempLogin || tempLogin.stage !== "awaiting-password") throw new Error("Not waiting for a password");
  // SRP via the package ROOT export (telegram.password.computeCheck) — the
  // subpath telegram/2fa.js is not resolvable inside the standalone build.
  const { Api } = await loadTelegramLib();
  try {
    const mod = await import("telegram");
    const tg = mod.default || mod;
    const pwdInfo = await tempLogin.client.invoke(new Api.account.GetPassword());
    const check = await tg.password.computeCheck(pwdInfo, String(password));
    await tempLogin.client.invoke(new Api.auth.CheckPassword({ password: check }));
  } catch (e) {
    const msg = String(e?.message || e);
    if (/PASSWORD_HASH_INVALID/i.test(msg)) throw new Error("رمز دو مرحله‌ای اشتباه است");
    if (/FLOOD_WAIT/i.test(msg)) throw new Error("تلگرام موقتاً محدود کرده؛ کمی بعد دوباره امتحان کن");
    throw e;
  }
  return finishLogin();
}

async function finishLogin() {
  const sessionString = tempLogin.client.session.save();
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  config.sessionString = sessionString;
  config.enabled = true;
  await kv.set("config", config);
  // Fresh authorization — any backlog "seen" marks from a dead/broken session
  // are meaningless now; let the catch-up scan see those chats again.
  await kv.set("backlogSeen", []);
  backlogAttempts.clear();
  try { await tempLogin.client.disconnect(); } catch {}
  const phone = tempLogin.phoneNumber;
  tempLogin = null;
  // Auth already succeeded and the session is saved — a failed auto-connect
  // must not surface as a 500; the admin can press reconnect afterwards.
  try {
    await ensureUserbot();
  } catch (e) {
    await audit({ kind: "connect-failed", detail: String(e?.message || e).slice(0, 300) });
  }
  await audit({ kind: "login", phone });
  return { stage: "connected", phone };
}

export async function logoutUserbot() {
  await stopUserbot();
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  config.sessionString = "";
  config.enabled = false;
  await kv.set("config", config);
  return true;
}

// Nuclear option for broken states (dead/revoked session, stuck mid-login):
// wipes EVERYTHING — persisted session, in-progress login, runtime caches.
// Never throws. After this the panel shows a clean login screen.
export async function resetUserbot() {
  stopBacklogLoop();
  if (tempLogin?.client) {
    try {
      await Promise.race([
        tempLogin.client.disconnect(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch {}
  }
  tempLogin = null;
  await logoutUserbot();
  savedIdsCache = { at: 0, ids: [] };
  chains.clear();
  ownSendIds.clear();
  backlogAttempts.clear();
  await kv.set("backlogSeen", []);
  await audit({ kind: "force-reset" });
  return true;
}

// ---------------------------------------------------------------------------
// incoming pipeline
// ---------------------------------------------------------------------------

async function getSavedContactIds(client, Api) {
  if (Date.now() - savedIdsCache.at < 10 * 60_000) return savedIdsCache.ids;
  try {
    const res = await client.invoke(new Api.contacts.GetContacts({ hash: "0" }));
    const ids = (res?.users || []).map((u) => u.id?.toString()).filter(Boolean);
    savedIdsCache = { at: Date.now(), ids };
    return ids;
  } catch {
    return [];
  }
}

function localHour(date, tz) {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(date));
  } catch {
    return date.getHours();
  }
}

function pickGreeting(config) {
  const h = localHour(new Date(), config.timeZone || "Asia/Tehran");
  if (h >= 5 && h < 12) return config.greetingMorning;
  if (h >= 12 && h < 17) return config.greetingNoon;
  if (h >= 17 && h < 22) return config.greetingEvening;
  return config.greetingDawn;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?؟،؛:«»"'()\[\]{}\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Split a document into ~900-char chunks on paragraph boundaries.
function chunkDoc(content) {
  const parts = String(content).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const p of parts) {
    if (cur && (cur + "\n\n" + p).length > 900) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : [String(content)];
}

const DOC_BUDGET_CHARS = 14_000;

// Lightweight keyword-RAG: best-matching doc chunks + scored Q/A pairs.
function buildKnowledgeContext(kb, incomingText) {
  const words = new Set(normalize(incomingText).split(" ").filter((w) => w.length > 2));
  const blocks = [];
  let budget = DOC_BUDGET_CHARS;

  const scoredChunks = [];
  for (const d of kb.filter((e) => e.kind === "doc")) {
    chunkDoc(d.content || "").forEach((c, i) => {
      let score = i === 0 ? 0.5 : 0; // intro always eligible
      for (const w of normalize(c).split(" ")) if (words.has(w)) score += 1;
      scoredChunks.push({ d, i, c, score });
    });
  }
  scoredChunks.sort((a, b) => b.score - a.score || a.i - b.i);
  for (const sc of scoredChunks) {
    if (sc.score <= 0.5 && sc.i !== 0) continue;
    const text = `[${sc.d.title}] ${sc.c}`;
    if (blocks.some((b) => b.startsWith(`[${sc.d.title}]`)) && sc.i === 0) continue;
    if (budget - text.length < 0) break;
    budget -= text.length;
    blocks.push(text);
    if (blocks.length >= 8) break;
  }

  const qaScored = [];
  for (const e of kb.filter((e) => e.kind !== "doc")) {
    let score = e.pinned ? 0.5 : 0;
    for (const w of normalize(e.q).split(" ")) if (words.has(w)) score += 1;
    if (score > 0.5) qaScored.push({ e, score });
  }
  qaScored.sort((a, b) => b.score - a.score);

  return { docs: blocks, qa: qaScored.slice(0, 4).map((s) => s.e) };
}

async function getAgent() {
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  if (config.agentId) {
    const agent = await getNovaAgentById(config.agentId);
    if (agent && agent.status === "active") return { config, agent };
  }
  const agents = await getNovaAgents();
  const fallback = agents.find((a) => a.role === "employee" && a.status === "active")
    || agents.find((a) => a.status === "active");
  return { config, agent: fallback || null };
}

async function handleIncoming(client, event) {
  const msg = event.message;
  if (!msg) return;
  // Outgoing = the OWNER typing on this account personally. That is exactly
  // the tone we want to learn — record it, never treat it as an incoming ask.
  if (msg.out) { await captureOutgoing(msg).catch(() => {}); return; }
  const text = String(msg.message || "").trim();
  if (!text || text.startsWith("/")) return;

  const { Api } = await loadTelegramLib();
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  if (!config.enabled || !config.activeSince) return;
  if (new Date(msg.date * 1000) < new Date(config.activeSince)) return;

  const peer = msg.peerId;
  const isPrivate = peer instanceof Api.PeerUser;
  const isGroupish = peer instanceof Api.PeerChat || peer instanceof Api.PeerChannel;
  if (!isPrivate && !isGroupish) return;

  let chatEntity = null;
  if (peer instanceof Api.PeerChannel) {
    chatEntity = await client.getEntity(peer).catch(() => null);
  }
  const isBroadcast = Boolean(chatEntity?.broadcast);
  // Private DMs are the core case — ALWAYS on. The toggles only govern
  // channels (broadcast posts) and groups.
  if (isPrivate) {
    // allowed
  } else if (isBroadcast) {
    if (!config.allowChannels) return;
  } else if (!config.allowGroups) {
    return;
  }

  // Humans only by default: anything posted BY a bot account is ignored
  // unless explicitly enabled — bot↔bot answers loop forever.
  const sender = await msg.getSender().catch(() => null);
  if (!sender) return;
  if (sender.bot && !config.allowBots) return;
  if (!isBroadcast && !(sender instanceof Api.User)) return;

  const chatId = String(isPrivate ? peer.userId : peer.channelId || peer.chatId);
  const name = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ")
    || sender?.username
    || (isBroadcast ? (chatEntity?.title || `channel-${chatId}`) : `user-${chatId}`);
  const username = sender?.username || "";

  if (isGroupish) {
    const mine = msg.replyTo && (await msg.getReplyMessage().catch(() => null));
    const replyingToMe = mine && String(mine.fromId?.userId || "") === globalThis.__novaTgMeId;
    if (!(msg.mentioned || replyingToMe)) return;
  }

  // exclusions
  if ((config.blacklist || []).some((b) => {
    const t = String(b).trim().toLowerCase().replace(/^@/, "");
    return t && (t === username.toLowerCase() || t === chatId);
  })) return;
  if (config.skipSavedContacts && isPrivate) {
    const saved = await getSavedContactIds(client, Api);
    if (saved.includes(chatId)) return;
  }

  await produceDraft({ client, chatId, name, username, text, msgId: String(msg.id || ""), msgDate: msg.date * 1000 });
}

// Shared by live incoming messages AND the backlog scanner: builds context
// from the KB + conversation, asks the model, stores a pending draft (or
// auto-sends once the contact crossed the approval threshold).
async function produceDraft({ client, chatId, name, username, text, msgId, viaBacklog, contextText, msgDate }) {
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  const contacts = (await kv.get("contacts", {})) || {};
  const state = contacts[chatId] || { name, approved: 0, total: 0, history: [], firstAt: new Date().toISOString() };
  state.name = name;
  const isFirstContact = state.total === 0;

  const kb = (await kv.get("kb", [])) || [];
  // Retrieval query = current message + recent context words, so a short
  // follow-up like "نوا پروکسی" still finds the right document chunk.
  const recentContext = (state.history || [])
    .slice(-4)
    .map((h) => h.text)
    .join(" ");
  const knowledge = buildKnowledgeContext(kb, `${text}\n${recentContext}`);

  const historyLines = (state.history || [])
    .map((h) => `${h.role === "me" ? "YOU(replied)" : h.role === "owner" ? "YOU(owner's own words)" : name}: ${String(h.text).slice(0, 300)}`)
    .join("\n");

  const knowledgeBlock = [
    knowledge.docs.length ? `OFFICIAL DOCUMENTS (excerpted, most relevant parts):\n${knowledge.docs.join("\n---\n")}` : "",
    knowledge.qa.length ? `VERIFIED Q&A:\n${knowledge.qa.map((k) => `- Q: ${k.q}\n  A: ${k.a}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  const voiceSamples = (((await kv.get("styleSamples", [])) || [])).slice(-10);
  const voiceBlock = voiceSamples.length
    ? `OWNER VOICE EXAMPLES — real messages the owner typed personally. Imitate this tone, wording and message length closely:\n${voiceSamples.map((s) => `«${String(s.text).slice(0, 220)}»`).join("\n")}`
    : "";

  const mems = pickMemories(((await kv.get("memories", [])) || []), `${text}\n${(historyLines || "").slice(-800)}`, 12);
  const memoryBlock = mems.length
    ? `MEMORY NOTES (facts learned from this person's past chats):\n${mems.map((m) => `- ${m.text}`).join("\n")}`
    : "";

  // Retrieve the owner's OWN past answers whose wording matches this question
  // — repeated customer questions get the same proven replies.
  const histAll = state.history || [];
  const qWords = new Set(normalize(`${text} ${recentContext}`).split(" ").filter((w) => w.length > 2));
  const scoredAnswers = [];
  for (let i = 0; i < histAll.length; i++) {
    const h = histAll[i];
    if ((h.role !== "me" && h.role !== "owner") || !h.text) continue;
    let s = 0;
    for (const w of normalize(h.text).split(" ")) if (qWords.has(w)) s++;
    for (const w of normalize((histAll[i - 1] || {}).text || "").split(" ")) if (qWords.has(w)) s += 0.5;
    if (s >= 2) scoredAnswers.push({ s, t: h.text });
  }
  scoredAnswers.sort((a, b) => b.s - a.s);
  const pastAnswersBlock = scoredAnswers.length
    ? `YOUR OWN PAST ANSWERS TO THIS PERSON on matching topics — reuse the same proven wording when relevant:\n${scoredAnswers.slice(0, 5).reverse().map((x) => `- ${x.t.slice(0, 300)}`).join("\n")}`
    : "";

  const system = [
    "You are replying AS the business owner to a customer, one short message at a time, like a real human support admin on Telegram.",
    [
      "SUPPORT FLOW (follow strictly):",
      "0. If the message is ONLY a thanks/prayer/goodbye (e.g. ممنون، مرسی، سپاس، خدا نگهدار), reply with ONE short warm closing line (like خواهش می‌کنم 🌹) — do NOT greet, do NOT ask what they need, do NOT open a new topic.",
      "1. If the customer's issue is vague or missing key info, do NOT guess and do NOT dump information. Reply with a warm greeting (if first contact) plus ONE short clarifying question — e.g. which service? where exactly is the problem? what did you try?",
      "2. Once you know exactly what they need, search OFFICIAL COMPANY KNOWLEDGE below and answer concretely: give the exact fix, steps, price or policy from it.",
      "3. Never invent facts not present in the knowledge; if it's not covered, say you'll check and get back, or answer generally.",
      "4. Read the conversation history first — if the context is already clear from earlier messages, answer THAT directly instead of starting over.",
    ].join("\n"),
    [
      "PERSIAN STYLE (critical — most customers write in colloquial spoken فارسی):",
      "- UNDERSTAND محاوره: people type slang, typos and stretched letters. Map them by meaning: «بهترینی» = تو بهترین هستی (compliment), «دمت گرم / مرسی / ممنون / لایک داری / دستت درد نکنه» = thanks, «عزیزی / داداش / جونم / قربونت برم» = warm friendly address, «چیکار کنم / گیر کردم / کلافه شدم» = I'm stuck, «اوکیه / باشه / حله» = OK agreed, «خعلی / خیییلی / نایس» = very / great.",
      "- MIRROR THE REGISTER: casual warm customer ⇒ casual warm reply («دمت گرم عزیزی 🌹», «خواهش داداش»). Formal customer ⇒ polite formal reply. NEVER answer slang with stiff bookish Persian or translated-sounding text.",
      "- A pure compliment/praise message (بهترینی، چه عالی، آفرین) gets ONLY one short warm thank-you line + maybe an emoji. Do not greet again, do not open a support topic, do not ask what they need.",
      "- ویراستاری: نیم‌فاصله درست بنویس (می‌کنم، می‌خوام، سپاسگزارم نه می کنم)؛ همیشه ی و ک فارسی نه ي و ك عربی؛ علائم ، ؟ ! در جای خودش؛ جمله‌ها کوتاه و طبیعی مثل چت واقعی؛ از قالب‌های اداری و کتابی پرهیز کن.",
    ].join("\n"),
    config.behaviorPrompt || "",
    voiceBlock,
    memoryBlock,
    pastAnswersBlock,
    knowledgeBlock
      ? `OFFICIAL COMPANY KNOWLEDGE — your only source of truth for specifics:\n${knowledgeBlock}`
      : "No verified company documents match this question yet — follow step 1 of the flow.",
    "Output ONLY the exact reply text to send. No quotes, no explanations, no signatures. Match the person's language — Persian replies must read like a native Persian chat message, never like a translation. Keep it short and human.",
  ].filter(Boolean).join("\n\n");

  const convoBlock = [
    historyLines ? `Recent conversation:\n${historyLines}` : "",
    contextText ? `Chat history pulled from Telegram:\n${contextText.slice(0, 6000)}` : "",
  ].filter(Boolean).join("\n");
  // A bare "thanks" is a closing, not a question — never bolt the greeting
  // script or a clarifying question onto it.
  const closingOnly = /^[\s\u200c]*(ممنون+|مرسی+|مچ+|سپاس+|تشکر+|لطف ?کردی|دست ?شما? درد ?نکنه|خدا ?بهت داد? بده|فدات|thx|ty|tnx|thanks|thank you)[\s!.؟\u200c]*$/i;

  // Greeting discipline + late-reply apology.
  const APOLOGY_TEXT = "درود امیدوار حالتون خوب یوده باشه و روز عالی داشته باشین عذرخواهی میکنم که خیلی دیر جواب شمارو میدم متاسفانه به دلیل مشغله ها خیلی کم میتونیم پاسخ بدیم ولی سعی کنید از ربات همیشه پیام بدین";
  const delayHours = msgDate ? Math.max(0, (Date.now() - msgDate) / 3_600_000) : 0;
  const longDelay = delayHours >= 24; // catch-ups for 1..30 day old messages
  const greetedRecently = state.lastGreetAt && Date.now() - state.lastGreetAt < GREET_COOLDOWN_MS;

  const user = [
    `Person: ${name}${username ? ` (@${username})` : ""}`,
    convoBlock || "(first interaction)",
    `New incoming message:\n"""${text.slice(0, 1500)}"""`,
    longDelay && !closingOnly
      ? `This reply is VERY LATE (${Math.round(delayHours)} hours). You MUST start your reply with EXACTLY this apology line, verbatim, as the first line — then answer below it. Do NOT add any other greeting:\n"""${APOLOGY_TEXT}"""`
      : isFirstContact && config.greetingEnabled && !closingOnly && !greetedRecently
        ? `This is their FIRST message. Start your reply with this greeting followed by your answer: "${pickGreeting(config)}"`
        : !closingOnly && greetedRecently
          ? "You already greeted this person recently — do NOT open with any greeting (سلام/درود). Reply directly to the point."
          : "",
  ].filter(Boolean).join("\n\n");

  if ((longDelay || (isFirstContact && config.greetingEnabled)) && !closingOnly) {
    state.lastGreetAt = Date.now();
    contacts[chatId] = state;
    await kv.set("contacts", contacts);
  }

  const { agent } = await getAgent();
  if (!agent) {
    await notifyAdmin("⚠️ پاسخگوی تلگرام: هیچ عامل فعالی برای پاسخ تعیین نشده. پیام ارسال نشد.");
    await audit({ kind: "no-agent", from: name, text: text.slice(0, 120) });
    return { ok: false, reason: "no-agent" };
  }

  let draft = "";
  let lastErr = null;
  try {
    draft = await generateWithAgent(agent, system, user);
  } catch (e) {
    lastErr = e;
  }
  if (!draft) {
    // Primary agent failed (quota exhausted / provider outage). Try other
    // active agents before giving up — a dead provider must not silently
    // drop the customer.
    const others = (await getNovaAgents())
      .filter((a) => a.status === "active" && a.id !== agent.id)
      .slice(0, 3);
    for (const alt of others) {
      try {
        draft = await generateWithAgent(alt, system, user);
        if (draft) {
          await audit({ kind: "fallback-agent", used: alt.name, forChat: name });
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
  }
  if (!draft) {
    // SILENT to the customer — never send an error to end users.
    const detail = String(lastErr?.message || lastErr || "empty response").slice(0, 200);
    await notifyAdmin(`⚠️ هیچ مدلی جواب نداد برای پیام از ${name}. هیچ پاسخی ارسال نشد.\n(${detail})`);
    await audit({ kind: "model-error", from: name, detail });
    return { ok: false, reason: "model-error" };
  }

  // Self-learning pass: on backlog catch-ups and first contacts, read the
  // whole thread and persist durable facts for future replies. Fail-open.
  if ((viaBacklog || isFirstContact) && !closingOnly) {
    const transcript = [
      contextText || "",
      historyLines || "",
      `${name}: ${text}`,
      `YOU: ${draft}`,
    ].filter(Boolean).join("\n\n");
    await extractMemories(transcript, name);
  }

  const auto = config.autoApproveAfterN > 0 && state.approved >= config.autoApproveAfterN;
  if (auto) {
    if (!outAllowed()) {
      await notifyAdmin(`⛔️ سقف ارسال ساعتی پر شد؛ پیام از ${name} بی‌پاسخ ماند.`);
      return;
    }
    const sent = await client.sendMessage(Number(chatId) || chatId, { message: draft });
    if (sent?.id) ownSendIds.add(String(sent.id));
    bumpOutgoing();
    state.total += 1;
    state.history = [...(state.history || []),
      { role: "them", text, tgId: String(msgId || ""), at: nowIso() },
      { role: "me", text: draft, tgId: String(sent?.id || ""), at: nowIso() },
    ].slice(-HISTORY_LIMIT);
    contacts[chatId] = state;
    await kv.set("contacts", contacts);
    await audit({ kind: "auto-sent", from: name, text: text.slice(0, 120), reply: draft.slice(0, 160) });
    await notifyAdmin(`🤖 خودکار به ${name} پاسخ دادم:\n«آنها»: ${text.slice(0, 150)}\n«من»: ${draft.slice(0, 200)}`);
    return { ok: true, sent: true };
  }

  const drafts = ((await kv.get("pendingDrafts", [])) || []);
  const draftItem = {
    id: randomUUID().slice(0, 8),
    chatId,
    name,
    username,
    isFirst: isFirstContact,
    incoming: text.slice(0, 800),
    draft: draft.slice(0, 3500),
    createdAt: new Date().toISOString(),
    agentName: agent.name,
    viaBacklog: Boolean(viaBacklog),
  };
  drafts.push(draftItem);
  while (drafts.length > DRAFTS_LIMIT) drafts.shift();
  await kv.set("pendingDrafts", drafts);

  try {
    const botConfig = await (await import("@/lib/db/repos/novaRepo.js")).getNovaTelegramConfig();
    if (!botConfig.botToken || !botConfig.adminChatId) throw new Error("bot bridge offline");
    await tgCall(botConfig.botToken, "sendMessage", {
      chat_id: botConfig.adminChatId,
      text: renderDraftCard(draftItem),
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ ارسال", callback_data: `ub|ok|${draftItem.id}` },
            { text: "❌ رد", callback_data: `ub|no|${draftItem.id}` },
          ],
          [{ text: "✏️ ویرایش متن", callback_data: `ub|edit|${draftItem.id}` }],
        ],
      },
    });
  } catch (e) {
    await notifyAdmin(`📩 پیام از ${name} نیاز به تأیید دارد ولی پل ربات در دسترس نیست.\nبرای ارسال: /rep ${draftItem.id} <متن>\nپیشنهاد: ${draft.slice(0, 400)}`);
  }
  await audit({ kind: "draft", from: name, text: text.slice(0, 120) });
  return { ok: true, sent: false, id: draftItem.id };
}

export async function cacheOwnId(client) {
  try {
    const me = await client.getMe();
    globalThis.__novaTgMeId = String(me.id?.toString?.() || "");
  } catch {}
}

// ---------------------------------------------------------------------------
// self-learning voice — the owner's own typed messages become style examples
// ---------------------------------------------------------------------------

async function rememberVoice(text) {
  const t = String(text || "").trim();
  if (t.length < 8 || t.startsWith("/")) return;
  const samples = ((await kv.get("styleSamples", [])) || []);
  if (samples.length && samples[samples.length - 1].text === t.slice(0, 400)) return;
  samples.push({ text: t.slice(0, 400), at: nowIso() });
  while (samples.length > 60) samples.shift();
  await kv.set("styleSamples", samples);
}

async function captureOutgoing(msg) {
  const text = String(msg.message || "").trim();
  if (!text || text.startsWith("/")) return;
  if (ownSendIds.has(String(msg.id))) return; // that was us, not the owner
  ownSendIds.add(String(msg.id));
  if (ownSendIds.size > 500) {
    // bound memory: drop the oldest half
    const keep = [...ownSendIds].slice(-250);
    ownSendIds.clear();
    for (const id of keep) ownSendIds.add(id);
  }
  await rememberVoice(text);
  const chatId = String(msg.peerId?.userId || "");
  if (!chatId) return;
  const contacts = (await kv.get("contacts", {})) || {};
  const state = contacts[chatId];
  if (state) {
    state.history = [...(state.history || []),
      { role: "owner", text: text.slice(0, 800), tgId: String(msg.id || ""), at: nowIso() },
    ].slice(-HISTORY_LIMIT);
    contacts[chatId] = state;
    await kv.set("contacts", contacts);
  }
}

// ---------------------------------------------------------------------------
// memory engine — durable facts learned from chats are stored and reused
// ---------------------------------------------------------------------------

const MEMORY_LIMIT = 250;

function normNote(t) {
  return String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Keyword-lite retrieval: notes sharing words with the current question come
// first, then the newest few so recent context is always available.
function pickMemories(memories, query, max = 12) {
  const qWords = new Set(String(query || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
  const scored = [];
  for (let i = memories.length - 1; i >= 0; i--) {
    const words = String(memories[i].text).toLowerCase().split(/[^\p{L}\p{N}]+/u);
    scored.push({ m: memories[i], s: words.filter((w) => qWords.has(w)).length });
  }
  const top = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, max - 3).map((x) => x.m);
  const out = [];
  const seen = new Set();
  for (const m of [...top, ...memories.slice(-3)]) {
    if (!seen.has(m.id)) { seen.add(m.id); out.push(m); }
    if (out.length >= max) break;
  }
  return out;
}

async function extractMemories(transcript, personName) {
  try {
    if (!transcript || transcript.length < 60) return;
    const { agent } = await getAgent();
    if (!agent) return;
    const system = [
      "You maintain CRM memory notes for a business owner who answers customers on Telegram.",
      "From the conversation, extract ONLY new durable facts worth remembering: services/products bought or asked about, carrier (اپراتور), problems and how they were solved, promises made, prices quoted, preferences.",
      "Ignore greetings, small talk and thanks.",
      `Return a strict JSON array of short Persian notes (max 5, each under 200 chars), prefixed with nothing else. Example: ["مشتری همراه اول است و از VLESS استفاده می‌کند","برای پنل نوا سرور ۲۰۰ هزار تومان پرداخت کرد"]. If nothing worth remembering: []`,
    ].join("\n");
    const user = `Conversation with ${personName}:\n${transcript.slice(-5000)}\n\nJSON array only:`;
    let raw = "";
    try { raw = await generateWithAgent(agent, system, user); } catch { return; }
    const match = String(raw || "").match(/\[[\s\S]*\]/);
    if (!match) return;
    let arr;
    try { arr = JSON.parse(match[0]); } catch { return; }
    if (!Array.isArray(arr)) return;
    const memories = ((await kv.get("memories", [])) || []);
    const existing = new Set(memories.map((m) => normNote(m.text)));
    let added = 0;
    for (const item of arr.slice(0, 5)) {
      const note = String(item || "").trim().slice(0, 300);
      const n = normNote(note);
      if (!n || n.length < 10 || existing.has(n)) continue;
      existing.add(n);
      memories.push({ id: randomUUID().slice(0, 8), text: note, name: personName || "", at: nowIso() });
      added++;
    }
    while (memories.length > MEMORY_LIMIT) memories.shift();
    if (added) {
      await kv.set("memories", memories);
      await audit({ kind: "memory", from: personName, count: added });
    }
  } catch {} // memory extraction must never break replying
}

export async function listMemories() {
  return (((await kv.get("memories", [])) || [])).slice().reverse();
}

export async function deleteMemory(id) {
  const memories = ((await kv.get("memories", [])) || []).filter((m) => m.id !== id);
  await kv.set("memories", memories);
  return memories.length;
}

export async function clearMemories() {
  await kv.set("memories", []);
  return 0;
}

// ---------------------------------------------------------------------------
// backlog worker — every tick, scan DMs for the OLDEST still-unanswered
// question and draft ONE reply for approval.
// ---------------------------------------------------------------------------

function stopBacklogLoop() {
  if (backlogTimer) { clearTimeout(backlogTimer); backlogTimer = null; }
}

function startBacklogLoop() {
  stopBacklogLoop();
  const run = async () => {
    backlogTimer = null;
    let delaySec = 60;
    let stop = false;
    try {
      const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
      delaySec = Math.max(20, Math.min(600, Number(config.backlogIntervalSec) || 60));
      if (!config.enabled || !config.backlogEnabled) {
        stop = true;
      } else if (!clientPromise) {
        // Connection still initializing (first tick fires early) — skip this
        // cycle; the reschedule below keeps the loop alive.
      } else {
        await runBacklogScan(await clientPromise);
      }
    } catch (e) {
      const dead = await handleAuthFailure(e).catch(() => false);
      if (dead) stop = true;
      else await audit({ kind: "scan-error", detail: String(e?.message || e).slice(0, 200) });
    } finally {
      if (!stop && !backlogTimer) backlogTimer = setTimeout(run, delaySec * 1000);
    }
  };
  backlogTimer = setTimeout(run, 10_000);
}

// One scan+draft pass. Returns a small summary for the dashboard button.
const SEEN_TTL_MS = 7 * 86_400_000;
const DRAFT_TTL_MS = 48 * 3_600_000;

export async function runBacklogScan(clientOverride) {
  const client = clientOverride || (clientPromise ? await clientPromise : null);
  if (!client) throw new Error("Userbot is not connected");
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  const horizonMs = Math.max(1, Math.min(90, Number(config.backlogDays) || 30)) * 86_400_000;
  const since = Date.now() - horizonMs;

  const { Api } = await loadTelegramLib();

  // Seen marks carry a timestamp and expire after 7 days. Legacy entries
  // (no "@ts" suffix) are treated as expired — they were the poisoned marks
  // from the era when failures got swallowed.
  const nowMs = Date.now();
  const seen = new Map(); // "chatId:msgId" -> markedAt(ms)
  for (const entry of ((await kv.get("backlogSeen", [])) || [])) {
    const at = Number(String(entry).split("@")[1]) || 0;
    if (at && nowMs - at < SEEN_TTL_MS) seen.set(String(entry).split("@")[0], at);
  }

  // Expire stale pending drafts so their chats re-enter the queue instead of
  // being blocked forever by an unanswered old card.
  const draftsArr = ((await kv.get("pendingDrafts", [])) || []);
  const liveDrafts = [];
  let expiredDrafts = 0;
  for (const d of draftsArr) {
    const at = Date.parse(d.createdAt || "") || 0;
    if (at && nowMs - at > DRAFT_TTL_MS) { expiredDrafts++; continue; }
    liveDrafts.push(d);
  }
  if (expiredDrafts) {
    await kv.set("pendingDrafts", liveDrafts);
    await audit({ kind: "drafts-expired", count: expiredDrafts });
  }
  const draftedChats = new Set(liveDrafts.map((d) => String(d.chatId)));

  const blacklist = (config.blacklist || []).map((b) => String(b).trim().toLowerCase().replace(/^@/, "")).filter(Boolean);
  const savedIds = config.skipSavedContacts ? await getSavedContactIds(client, Api) : [];

  const candidates = [];
  const dialogs = await client.getDialogs({ limit: 60 });
  for (const d of dialogs) {
    const ent = d.entity;
    if (!(ent instanceof Api.User)) continue; // private chats only
    if (ent.bot || ent.self) continue; // bots & Saved Messages
    const chatId = String(ent.id?.toString?.() || ent.id || "");
    if (!chatId) continue;
    if (blacklist.includes(chatId) || (ent.username && blacklist.includes(ent.username.toLowerCase()))) continue;
    if (savedIds.includes(chatId)) continue;

    const msgs = await client.getMessages(ent, { limit: 20 });
    let target = null;
    for (const m of msgs) {
      if (!m || !m.date) continue;
      if (m.out) break; // anything below was already answered by us
      const t = String(m.message || "").trim();
      if (!t || t.startsWith("/")) continue;
      if (m.date * 1000 < since) break; // older than the horizon
      target = m;
      break;
    }
    if (!target) continue;
    if (seen.has(`${chatId}:${target.id}`)) continue;
    if (draftedChats.has(chatId)) continue;
    // Failed attempts get a cooldown instead of being poisoned as "seen".
    const lastTry = backlogAttempts.get(chatId) || 0;
    if (Date.now() - lastTry < 15 * 60_000) continue;

    // Context = the rest of the recent chat (older than the unanswered msg),
    // so the model understands WHAT the thread is about before replying.
    const entName = [ent.firstName, ent.lastName].filter(Boolean).join(" ") || ent.username || `user-${chatId}`;
    const ctxParts = [];
    for (const m of msgs) {
      if (!m || m.id === target.id) continue;
      const t = String(m.message || "").trim();
      if (!t || t.startsWith("/")) continue;
      ctxParts.push(`${m.out ? "YOU" : entName}: ${t.slice(0, 160)}`);
      if (ctxParts.length >= 6) break;
    }
    candidates.push({ chatId, msg: target, entity: ent, contextText: ctxParts.reverse().join("\n") });
  }

  if (!candidates.length) return { found: 0, processed: null };

  // Oldest unanswered first so nobody is left hanging.
  candidates.sort((a, b) => a.msg.date - b.msg.date);
  const pick = candidates[0];
  const name = [pick.entity.firstName, pick.entity.lastName].filter(Boolean).join(" ") || pick.entity.username || `user-${pick.chatId}`;

  // DEEP READ — the chosen chat is read top-to-bottom (up to 100 messages)
  // so the model sees the whole thread, not just its tail.
  let deepContext = pick.contextText || "";
  try {
    const full = await client.getMessages(pick.entity, { limit: 100 });
    const parts = [];
    for (const m of full) {
      if (!m) continue;
      const t = String(m.message || "").trim();
      if (!t || t.startsWith("/")) continue;
      parts.push(`${m.out ? "YOU" : name}: ${t.slice(0, 200)}`);
      if (parts.length >= 80) break;
    }
    parts.reverse();
    if (parts.length) deepContext = parts.join("\n").slice(0, 6000);
  } catch {}

  // Mark as seen ONLY after a draft was actually produced — a model failure
  // must never silently swallow the message.
  const result = await produceDraft({
    client,
    chatId: pick.chatId,
    name,
    username: pick.entity.username || "",
    text: String(pick.msg.message || "").trim(),
    msgId: String(pick.msg.id || ""),
    viaBacklog: true,
    contextText: deepContext,
    msgDate: pick.msg.date * 1000,
  });

  if (result?.ok) {
    backlogAttempts.delete(pick.chatId);
    seen.set(`${pick.chatId}:${pick.msg.id}`, Date.now());
    const seenArr = [...seen.entries()].map(([k, t]) => `${k}@${t}`);
    while (seenArr.length > 2000) seenArr.shift();
    await kv.set("backlogSeen", seenArr);
    await audit({ kind: "backlog-draft", from: name, text: String(pick.msg.message || "").slice(0, 120) });
    return { found: candidates.length, processed: name };
  }

  backlogAttempts.set(pick.chatId, Date.now());
  await audit({ kind: "backlog-failed", from: name, reason: result?.reason || "unknown" });
  return { found: candidates.length, processed: null };
}

// ---------------------------------------------------------------------------
// draft resolution (called from the bot bridge)
// ---------------------------------------------------------------------------

const CARD_MARKERS = ["📩 پیام جدید از", "🕰 پیام بی‌جواب از"];

// Single source of truth for how a draft card looks — used when the card is
// first sent AND every time an edit re-renders it in place.
export function renderDraftCard(item) {
  return [
    `${item.viaBacklog ? "🕰 پیام بی‌جواب از" : "📩 پیام جدید از"} ${item.name}${item.username ? ` (@${item.username})` : ""}`,
    ``,
    `«${String(item.incoming || "").slice(0, 600)}»`,
    ``,
    `✍️ پیشنهاد پاسخ (${item.agentName || "agent"}):`,
    `«${String(item.draft || "").slice(0, 3500)}»`,
    ``,
    `✅ ارسال / ❌ رد با دکمه‌ها — ✏️ یا ریپلای روی کارت برای ویرایش (ارسال فقط با ✅)`,
    `\u200e#${item.id}`,
  ].join("\n");
}

// Update a pending draft's text WITHOUT sending anything. The admin reviews
// the re-rendered card; nothing reaches the customer until ✅ is pressed.
export async function updateUserbotDraft(id, newText) {
  const drafts = ((await kv.get("pendingDrafts", [])) || []);
  const item = drafts.find((d) => d.id === id);
  if (!item) return { ok: false, reason: "not-found" };
  const t = String(newText || "").trim();
  if (!t) return { ok: false, reason: "empty" };
  item.draft = t.slice(0, 3500);
  await kv.set("pendingDrafts", drafts);
  await audit({ kind: "draft-edited", id });
  return { ok: true, item };
}

// Sweep leftover draft cards out of the BOT conversation (owner ↔ bridge bot).
// Deletes ONLY inside that bot chat — customer conversations are never touched.
export async function cleanupBotCards() {
  if (!clientPromise) return { ok: false, reason: "offline" };
  const client = await clientPromise;
  const tg = await getNovaTelegramConfig();
  const botId = String(tg.botToken || "").split(":")[0];
  if (!/^\d+$/.test(botId)) return { ok: false, reason: "no-bot" };
  const msgs = await client.getMessages(Number(botId), { limit: 200 });
  const ids = (msgs || [])
    .filter((m) => m && !m.out && CARD_MARKERS.some((k) => String(m.message || "").includes(k)))
    .map((m) => m.id);
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      await client.deleteMessages(Number(botId), chunk, { revoke: true });
      deleted += chunk.length;
    } catch {}
  }
  await audit({ kind: "bot-cards-cleanup", count: deleted });
  return { ok: true, deleted };
}

export async function resolveUserbotDraft(id, action, newText) {  const drafts = ((await kv.get("pendingDrafts", [])) || []);
  const idx = drafts.findIndex((d) => d.id === id);
  if (idx === -1) return { ok: false, reason: "not-found" };

  if (action === "no") {
    drafts.splice(idx, 1);
    await kv.set("pendingDrafts", drafts);
    await audit({ kind: "rejected", id });
    return { ok: true, sent: false };
  }

  const item = drafts[idx];
  const finalText = String(newText ?? item.draft ?? "").trim();
  if (!finalText) return { ok: false, reason: "empty" };
  if (!clientPromise) return { ok: false, reason: "offline" };

  const client = await clientPromise;
  if (!outAllowed()) {
    await notifyAdmin("⛔️ سقف ارسال ساعتی پر شد؛ ارسال انجام نشد.");
    return { ok: false, reason: "rate-cap" };
  }
  const sent = await client.sendMessage(Number(item.chatId) || item.chatId, { message: finalText });
  if (sent?.id) ownSendIds.add(String(sent.id));
  bumpOutgoing();
  // An edited approval is the owner's own wording — perfect voice material.
  if (newText) await rememberVoice(finalText);

  drafts.splice(idx, 1);
  await kv.set("pendingDrafts", drafts);

  const contacts = (await kv.get("contacts", {})) || {};
  const state = contacts[item.chatId] || { name: item.name, approved: 0, total: 0, history: [] };
  state.approved += 1;
  state.total += 1;
  state.history = [...(state.history || []),
    { role: "them", text: item.incoming, at: nowIso() },
    { role: "me", text: finalText, tgId: String(sent?.id || ""), at: nowIso() },
  ].slice(-HISTORY_LIMIT);
  contacts[item.chatId] = state;
  await kv.set("contacts", contacts);
  await audit({ kind: "sent", from: item.name, manual: Boolean(newText), text: finalText.slice(0, 160) });

  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  if (config.autoApproveAfterN > 0 && state.approved === config.autoApproveAfterN) {
    await notifyAdmin(`🔓 ${item.name} به آستانه ${config.autoApproveAfterN} پاسخ تأییدشده رسید؛ از این به بعد پاسخ‌هایش خودکار ارسال می‌شود (با گزارش).`);
  }
  return { ok: true, sent: true };
}

export async function setUserActiveSince() {
  const config = { ...DEFAULT_CONFIG, ...(await kv.get("config")) };
  config.activeSince = new Date().toISOString();
  await kv.set("config", config);
  return config.activeSince;
}

// ---------------------------------------------------------------------------
// dashboard helpers — pending drafts, conversations, editing a sent message
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

export async function listDrafts() {
  return (((await kv.get("pendingDrafts", [])) || [])).slice().reverse();
}

export async function listContacts() {
  const contacts = (await kv.get("contacts", {})) || {};
  return Object.entries(contacts)
    .map(([chatId, s]) => {
      const history = [...(s.history || [])].reverse();
      return {
        chatId,
        name: s.name || `user-${chatId}`,
        total: s.total || 0,
        approved: s.approved || 0,
        lastMe: history.find((h) => h.role === "me") || null,
        lastAt: history[0]?.at || "",
      };
    })
    .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
    .slice(0, 30);
}

// Edits a message the userbot ALREADY SENT in Telegram (messages.editMessage)
// and keeps the stored history in sync so future replies use the new text.
export async function editSentMessage({ chatId, tgId, text }) {
  const newText = String(text || "").trim();
  if (!chatId || !tgId) throw new Error("chatId and messageId are required");
  if (!newText) throw new Error("New text is required");
  if (!clientPromise) throw new Error("Userbot is not connected");
  const client = await clientPromise;
  await client.editMessage(Number(chatId) || chatId, { message: Number(tgId) || tgId, text: newText });
  bumpOutgoing();

  const contacts = (await kv.get("contacts", {})) || {};
  const state = contacts[String(chatId)];
  if (state?.history?.length) {
    for (let i = state.history.length - 1; i >= 0; i--) {
      const h = state.history[i];
      if (h.role === "me" && String(h.tgId || "") === String(tgId)) {
        h.text = newText;
        break;
      }
    }
    contacts[String(chatId)] = state;
    await kv.set("contacts", contacts);
  }
  await audit({ kind: "edited", from: state?.name || String(chatId), text: newText.slice(0, 160) });
  return true;
}

export { cacheOwnId as __cacheOwnId };
