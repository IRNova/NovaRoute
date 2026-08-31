import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/lib/dataDir";
import { getSettings } from "@/lib/localDb";
import { timingSafeEqualStr } from "@/lib/auth/timingSafe";

const DEFAULT_PASSWORD = "123456";

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, "jwt-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {}
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const SECRET = new TextEncoder().encode(loadJwtSecret());

// Session revocation epoch. The effective signing key is baseSecret:epoch, so
// bumping the persisted epoch instantly invalidates every previously issued
// token (all devices). Epoch reads are cached briefly to keep verification cheap.
const EPOCH_TTL_MS = 30_000;
let cachedEpoch = null;
let epochReadAt = 0;

async function getJwtEpoch() {
  const now = Date.now();
  if (cachedEpoch !== null && now - epochReadAt < EPOCH_TTL_MS) return cachedEpoch;
  try {
    const { makeKv } = await import("@/lib/db/helpers/kvStore.js");
    const kv = makeKv("security");
    cachedEpoch = String((await kv.get("jwtEpoch", "0")) ?? "0");
    epochReadAt = now;
  } catch {
    if (cachedEpoch === null) cachedEpoch = "0";
  }
  return cachedEpoch;
}

export async function revokeAllSessions() {
  try {
    const { makeKv } = await import("@/lib/db/helpers/kvStore.js");
    const kv = makeKv("security");
    await kv.set("jwtEpoch", String(Date.now()));
  } finally {
    // Even if persistence failed, rotate the in-process epoch so this
    // instance stops accepting old tokens immediately.
    cachedEpoch = String(Date.now());
    epochReadAt = Date.now();
  }
  return true;
}

async function getSecretBytes() {
  const epoch = await getJwtEpoch();
  if (cachedEpoch !== null && epoch === "0") return SECRET;
  return new TextEncoder().encode(`${loadJwtSecret()}:${epoch}`);
}

export function shouldUseSecureCookie(request) {
  // Secure cookies are SILENTLY dropped by browsers on plain HTTP, which
  // locks the user out right after a successful login (page just "reloads").
  // So the flag follows the actual request protocol, not a static env var:
  //   - direct HTTP (http://IP:port)      -> no Secure flag -> works
  //   - HTTPS via proxy / Caddy           -> Secure flag    -> works
  // AUTH_COOKIE_SECURE=false force-disables even behind TLS-terminating proxies.
  if (process.env.AUTH_COOKIE_SECURE === "false") return false;
  // Prefer the wrapper-stamped protocol (custom-server.js) over the raw
  // client-supplied x-forwarded-proto header.
  const stampedProto = request?.headers?.get?.("x-9r-proto");
  if (stampedProto === "https") return true;
  if (stampedProto === "http") return false;
  const forwardedProto = request?.headers?.get?.("x-forwarded-proto");
  return forwardedProto === "https";
}

export async function createDashboardAuthToken(claims = {}) {
  return new SignJWT({ authenticated: true, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(await getSecretBytes());
}

// ─── Pre-2FA tokens ────────────────────────────────────────────────────────
// Issued after a correct password when TOTP is enabled; grants ONLY the right
// to complete the second factor. verifyDashboardAuthToken() rejects them so a
// half-authenticated client can never reach the dashboard.

export async function createPre2faToken(claims = {}) {
  return new SignJWT({ pre2fa: true, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(await getSecretBytes());
}

export async function verifyPre2faToken(token) {
  return (await readPre2faToken(token)) !== null;
}

/** Payload of a valid pre-2FA token (identity claims included), else null. */
export async function readPre2faToken(token) {
  if (!token) {
    console.error("[pre2fa] reject: empty token");
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, await getSecretBytes());
    return payload?.pre2fa === true ? payload : null;
  } catch (e) {
    console.error("[pre2fa] verify failed:", e?.code || "", e?.message);
    return null;
  }
}

// ─── Session registry ──────────────────────────────────────────────────────
// Stateless JWTs + a lightweight registry: each login stores metadata under
// kv "security"."sessions" and embeds its sid in the token. Revoking a sid
// (individually or via epoch rotation) cuts that device off.
const SESSIONS_TTL_MS = 15_000;

let sessionsCache = null;
let sessionsReadAt = 0;

async function loadSessions(force = false) {
  const now = Date.now();
  if (!force && sessionsCache && now - sessionsReadAt < SESSIONS_TTL_MS) return sessionsCache;
  try {
    const { makeKv } = await import("@/lib/db/helpers/kvStore.js");
    const obj = await makeKv("security").get("sessions", {});
    sessionsCache = obj && typeof obj === "object" ? obj : {};
    sessionsReadAt = now;
  } catch {
    if (!sessionsCache) sessionsCache = {};
  }
  return sessionsCache;
}

export async function registerLoginSession({ ip, userAgent, username }) {
  const sid = crypto.randomUUID();
  try {
    const sessions = await loadSessions(true);
    sessions[sid] = {
      createdAt: new Date().toISOString(),
      ip: ip || "",
      userAgent: String(userAgent || "").slice(0, 200),
      username: String(username || "").slice(0, 64),
    };
    // Keep the newest 20 entries.
    const trimmed = Object.entries(sessions)
      .sort((a, b) => String(b[1]?.createdAt || "").localeCompare(String(a[1]?.createdAt || "")))
      .slice(0, 20);
    const pruned = Object.fromEntries(trimmed);
    sessionsCache = pruned;
    sessionsReadAt = Date.now();
    const { makeKv } = await import("@/lib/db/helpers/kvStore.js");
    await makeKv("security").set("sessions", pruned);
  } catch {}
  return sid;
}

export async function listSessions() {
  const sessions = await loadSessions(true);
  return Object.entries(sessions)
    .map(([sid, meta]) => ({ sid, ...meta }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

const REVOKED_TTL_MS = 15_000;
let revokedCache = null;
let revokedReadAt = 0;

async function loadRevoked(force = false) {
  const now = Date.now();
  if (!force && revokedCache && now - revokedReadAt < REVOKED_TTL_MS) return revokedCache;
  try {
    const { makeKv } = await import("@/lib/db/helpers/kvStore.js");
    const arr = await makeKv("security").get("revokedSessions", []);
    revokedCache = Array.isArray(arr) ? arr : [];
    revokedReadAt = now;
  } catch {
    if (!revokedCache) revokedCache = [];
  }
  return revokedCache;
}

export async function revokeSession(sid) {
  if (!sid) return false;
  try {
    const { makeKv } = await import("@/lib/db/helpers/kvStore.js");
    const revoked = await loadRevoked(true);
    if (!revoked.includes(sid)) revoked.push(sid);
    while (revoked.length > 200) revoked.shift();
    await makeKv("security").set("revokedSessions", revoked);
    const sessions = await loadSessions(true);
    delete sessions[sid];
    sessionsCache = sessions;
    sessionsReadAt = Date.now();
    await makeKv("security").set("sessions", sessions);
    return true;
  } catch {
    return false;
  }
}

export async function verifyDashboardAuthToken(token) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, await getSecretBytes());
    // Pre-2FA tokens only unlock the second-factor endpoint, never the app.
    if (payload?.pre2fa === true) return false;
    // Individually revoked sessions (device-level logout).
    if (payload?.sid && (await loadRevoked()).includes(payload.sid)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function getDashboardAuthSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getSecretBytes());
    if (payload?.pre2fa === true) return null;
    if (payload?.sid && (await loadRevoked()).includes(payload.sid)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setDashboardAuthCookie(cookieStore, request, claims = {}) {
  const token = await createDashboardAuthToken(claims);
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "lax",
    path: "/",
  });
}

export function clearDashboardAuthCookie(cookieStore) {
  cookieStore.delete("auth_token");
}

// Verify the current dashboard password (re-auth for sensitive actions).
export async function verifyDashboardPassword(password) {
  if (typeof password !== "string" || !password) return false;
  if (await verifyMasterPassword(password)) return true;
  const settings = await getSettings();
  const storedHash = settings?.password;
  if (storedHash) return bcrypt.compare(password, storedHash);
  const initialPassword = process.env.INITIAL_PASSWORD || DEFAULT_PASSWORD;
  return timingSafeEqualStr(password, initialPassword);
}

// Emergency break-glass credential: when ADMIN_MASTER_PASSWORD is set in the
// environment it always grants access, regardless of what is stored in the
// database. Intended for recovery from a lost/changed password on self-hosted
// servers. Remove the env var once access is restored.
export async function verifyMasterPassword(password) {
  const master = process.env.ADMIN_MASTER_PASSWORD;
  return typeof password === "string" && !!master && timingSafeEqualStr(password, master);
}
