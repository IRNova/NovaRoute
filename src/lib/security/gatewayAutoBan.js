// Gateway auto-ban: after N failed API-key authentications on /v1 within a
// window, ban the source IP for a cooldown period. State lives in SQLite
// (kv "security") so bans survive restarts; enforcement reads are cached
// briefly so the request path stays cheap.
//
// Fail-open everywhere: if persistence errors out we never block traffic.
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("security");
const FAILS_KEY = "authFails";
const BANS_KEY = "autoBans";
const CACHE_TTL_MS = 20_000;

function num(v, dflt) {
  const n = Number(process.env[v]);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

function threshold() {
  return num("NR_AUTOBAN_THRESHOLD", 10);
}
function windowMs() {
  return num("NR_AUTOBAN_WINDOW_MS", 15 * 60 * 1000);
}
export function banDurationMs() {
  return num("NR_AUTOBAN_DURATION_MS", 24 * 60 * 60 * 1000);
}

let bannedCache = null;
let bannedCacheAt = 0;

async function loadBans(force = false) {
  const now = Date.now();
  if (!force && bannedCache && now - bannedCacheAt < CACHE_TTL_MS) return bannedCache;
  try {
    const obj = await kv.get(BANS_KEY, {});
    bannedCache = obj && typeof obj === "object" ? obj : {};
    bannedCacheAt = now;
  } catch {
    if (!bannedCache) bannedCache = {};
  }
  return bannedCache;
}

function loopback(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "";
}

/** Record a failed gateway authentication for this IP; may trigger a ban. */
export async function recordGatewayAuthFailure(ip) {
  try {
    if (!ip || loopback(ip)) return { banned: false };
    const fails = (await kv.get(FAILS_KEY, {})) || {};
    // Prune stale counters while writing.
    const cutoff = Date.now() - windowMs();
    const entry = fails[ip] && fails[ip].firstAt >= cutoff ? fails[ip] : { count: 0, firstAt: Date.now() };
    entry.count += 1;
    entry.lastAt = Date.now();
    fails[ip] = entry;

    let banned = false;
    if (entry.count >= threshold()) {
      delete fails[ip];
      const bans = await loadBans(true);
      bans[ip] = { at: Date.now(), until: Date.now() + banDurationMs(), reason: "repeated gateway auth failures" };
      await kv.set(BANS_KEY, bans);
      banned = true;
      try {
        const { logAudit } = await import("@/lib/compliance/auditTrail.js");
        await logAudit({
          action: "gateway-auto-ban",
          severity: "warning",
          provider: "",
          details: `IP ${ip} banned after ${entry.count} failed gateway authentications`,
        });
      } catch {}
      try {
        const { notifyEvent } = await import("@/lib/notify/events.js");
        await notifyEvent({
          event: "gateway.autoban",
          severity: "warning",
          title: "Auto-ban triggered",
          message: `IP ${ip} was banned for ${Math.round(banDurationMs() / 3600000)}h after ${entry.count} failed gateway authentications.`,
          payload: { ip },
        });
      } catch {}
    } else {
      await kv.set(FAILS_KEY, fails);
    }
    return { banned };
  } catch {
    return { banned: false };
  }
}

/** Enforcement check — true when this IP currently serves an active auto-ban. */
export async function isIpAutoBanned(ip) {
  try {
    if (!ip || loopback(ip)) return false;
    const bans = await loadBans();
    const b = bans[ip];
    if (!b) return false;
    if (b.until && Date.now() > b.until) {
      const fresh = await loadBans(true);
      delete fresh[ip];
      await kv.set(BANS_KEY, fresh);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Manual/permanent ban used by the Security page so blocks are enforced. */
export async function banIpManually(ip) {
  try {
    if (!ip || loopback(ip)) return false;
    const bans = await loadBans(true);
    bans[ip] = { at: Date.now(), until: null, reason: "manual block" };
    await kv.set(BANS_KEY, bans);
    return true;
  } catch {
    return false;
  }
}

/** Lift any ban (auto or manual) for this IP. */
export async function unbanIp(ip) {
  try {
    const bans = await loadBans(true);
    if (bans[ip]) {
      delete bans[ip];
      await kv.set(BANS_KEY, bans);
    }
    return true;
  } catch {
    return false;
  }
}

/** Active auto-ban entries for display merging. */
export async function listActiveBans() {
  const bans = await loadBans(true);
  const now = Date.now();
  return Object.entries(bans)
    .filter(([, b]) => !b?.until || now < b.until)
    .map(([ip, b]) => ({ ip, until: b.until ? new Date(b.until).toISOString() : null, reason: b.reason || "" }));
}
