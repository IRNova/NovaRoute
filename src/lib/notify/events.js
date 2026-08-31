// Central event notifier: Telegram (via the admin bot) + user-configured
// webhooks, gated by settings.notifications and a per-event rate limiter so
// chatty events can never flood the admin.
//
// Fail-open everywhere: notification problems are logged, never thrown.
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const RATE_LIMIT_MS = 10 * 60 * 1000;
const SEVERITY_ORDER = { info: 0, warning: 1, error: 2 };

let settingsCache = null;
let settingsReadAt = 0;

async function loadNotifySettings(force = false) {
  const now = Date.now();
  if (!force && settingsCache && now - settingsReadAt < 30_000) return settingsCache;
  try {
    const { getSettings } = await import("@/lib/localDb");
    const n = (await getSettings())?.notifications;
    settingsCache =
      n && typeof n === "object"
        ? {
            enabled: n.enabled === true,
            minSeverity: ["info", "warning", "error"].includes(n.minSeverity) ? n.minSeverity : "warning",
            telegram: n.telegram !== false,
            webhooks: n.webhooks !== false,
          }
        : { enabled: false, minSeverity: "warning", telegram: true, webhooks: true };
    settingsReadAt = now;
  } catch {
    settingsCache = { enabled: false, minSeverity: "warning", telegram: true, webhooks: true };
  }
  return settingsCache;
}

async function shouldSend(event, severity) {
  const cfg = await loadNotifySettings();
  if (!cfg.enabled) return false;
  if ((SEVERITY_ORDER[severity] ?? 1) < (SEVERITY_ORDER[cfg.minSeverity] ?? 1)) return false;

  // Per-event-type rate limit.
  try {
    const kv = makeKv("notifyState");
    const state = (await kv.get("lastSent", {})) || {};
    const last = state[event] || 0;
    if (Date.now() - last < RATE_LIMIT_MS) return false;
    state[event] = Date.now();
    await kv.set("lastSent", state);
  } catch {}
  return true;
}

/**
 * notifyEvent({ event, severity, title, message, payload })
 * event   — machine name, e.g. "gateway.autoban" (used for rate limiting and
 *           webhook event filtering)
 */
export async function notifyEvent({ event, severity = "warning", title, message, payload } = {}) {
  try {
    if (!(await shouldSend(event, severity))) return { sent: false, reason: "rate-limited-or-disabled" };

    const text = `⚠ ${title || event}\n${message || ""}`.trim();
    const results = {};

    // Telegram — canonical admin-bot path.
    try {
      const cfg = await loadNotifySettings();
      if (cfg.telegram) {
        const { notifyAdmin } = await import("@/lib/nova/telegramApi.js");
        results.telegram = await notifyAdmin(text);
      }
    } catch (e) {
      console.warn("[Notify] telegram failed:", e?.message);
    }

    // Webhooks — fan-out to every active hook subscribed to this event.
    try {
      const cfg = await loadNotifySettings();
      if (cfg.webhooks) {
        const { getWebhooks, recordWebhookDelivery } = await import("@/lib/db/repos/webhooksRepo.js");
        const { deliverWebhook } = await import("@/lib/webhooks/deliver.js");
        const hooks = await getWebhooks();
        const targets = hooks.filter(
          (w) => w.active && (!Array.isArray(w.events) || w.events.length === 0 || w.events.includes(event))
        );
        for (const w of targets.slice(0, 10)) {
          const result = await deliverWebhook(w.url, {
            secret: w.secret,
            method: w.method,
            event,
            payload: { title, message, severity, ...(payload || {}) },
          });
          recordWebhookDelivery(w.id, result).catch(() => {});
        }
        results.webhooks = targets.length;
      }
    } catch (e) {
      console.warn("[Notify] webhooks failed:", e?.message);
    }

    return { sent: true, results };
  } catch (e) {
    console.warn("[Notify] failed:", e?.message);
    return { sent: false };
  }
}
