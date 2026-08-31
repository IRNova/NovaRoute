// Audit trail for administrative actions.
//
// Every state-changing call to a management route is recorded: when, who
// (session, CLI token or API key), from where, and what was touched. Reads are
// not logged — the point is answering "what changed, and who changed it" after
// an incident, not building a traffic log.
//
// Storage is the kv table (scope "security", key "adminAudit"), capped at
// AUDIT_LIMIT entries. Writes are fire-and-forget: auditing must never fail a
// request or slow the hot path.

import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("security");
const AUDIT_KEY = "adminAudit";
const AUDIT_LIMIT = 500;
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Routes whose bodies are noisy or whose writes are not administrative.
const IGNORED_PREFIXES = [
  "/api/locale",
  "/api/init",
  "/api/health",
  "/api/metrics",
  "/api/dashboard/nova/telegram/webhook",
];

// Paths worth calling out in the UI as sensitive.
const SENSITIVE_PREFIXES = [
  "/api/auth/",
  "/api/keys",
  "/api/settings/database",
  "/api/setup",
  "/api/shutdown",
  "/api/version/update",
  "/api/oauth",
  "/api/tunnel",
  "/api/cli-tools",
];

let pending = null;

export function shouldAudit(method, pathname) {
  if (!MUTATING_METHODS.has(String(method || "").toUpperCase())) return false;
  if (!pathname.startsWith("/api/")) return false;
  return !IGNORED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isSensitivePath(pathname) {
  return SENSITIVE_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Record one administrative action. Never throws.
 *
 * @param {{method: string, path: string, actor: string, ip?: string, userAgent?: string}} entry
 */
export async function recordAdminAction(entry) {
  try {
    const item = {
      at: new Date().toISOString(),
      method: String(entry.method || "").toUpperCase(),
      path: String(entry.path || "").slice(0, 200),
      actor: String(entry.actor || "unknown"),
      ip: String(entry.ip || ""),
      userAgent: String(entry.userAgent || "").slice(0, 120),
      sensitive: isSensitivePath(String(entry.path || "")),
    };
    // Coalesce concurrent writers so a burst of calls does not lose entries.
    pending = (pending || Promise.resolve())
      .then(async () => {
        const log = (await kv.get(AUDIT_KEY, [])) || [];
        log.unshift(item);
        await kv.set(AUDIT_KEY, log.slice(0, AUDIT_LIMIT));
      })
      .catch(() => {});
    await pending;
  } catch {
    // auditing is best-effort
  }
}

/** Most recent entries, newest first. */
export async function listAdminActions({ limit = 100, sensitiveOnly = false } = {}) {
  try {
    const log = (await kv.get(AUDIT_KEY, [])) || [];
    const rows = sensitiveOnly ? log.filter((e) => e.sensitive) : log;
    return rows.slice(0, Math.max(1, Math.min(limit, AUDIT_LIMIT)));
  } catch {
    return [];
  }
}

export async function clearAdminActions() {
  try {
    await kv.set(AUDIT_KEY, []);
    return true;
  } catch {
    return false;
  }
}
