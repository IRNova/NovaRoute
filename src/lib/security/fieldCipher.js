// Field-level encryption for sensitive provider credentials stored in SQLite
// (apiKey, accessToken, refreshToken, idToken). AES-256-GCM keyed off
// API_KEY_SECRET. Values carry an "enc:v1:" prefix so legacy plaintext rows
// remain readable (and get encrypted the next time they are written).
// Without API_KEY_SECRET set, everything stays plaintext (previous behavior).
import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const SENSITIVE_FIELDS = ["apiKey", "accessToken", "refreshToken", "idToken"];

let cachedKey = null;

function deriveKey() {
  const secret = process.env.API_KEY_SECRET;
  if (!secret) return null;
  if (!cachedKey) {
    cachedKey = crypto.createHash("sha256").update(`novaroute-fields:${secret}`).digest();
  }
  return cachedKey;
}

function encryptValue(key, plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

function decryptValue(key, stored) {
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Encrypt sensitive string fields on a connection-like object (in place). */
export function encryptSensitiveFields(obj) {
  const key = deriveKey();
  if (!key || !obj || typeof obj !== "object") return obj;
  for (const field of SENSITIVE_FIELDS) {
    const v = obj[field];
    if (typeof v === "string" && v && !v.startsWith(PREFIX)) {
      try {
        obj[field] = encryptValue(key, v);
      } catch { /* fail-open: keep plaintext rather than lose a credential */ }
    }
  }
  return obj;
}

/** Decrypt sensitive fields on a parsed connection object (returns same object). */
export function decryptSensitiveFields(obj) {
  const key = deriveKey();
  if (!key || !obj || typeof obj !== "object") return obj;
  for (const field of SENSITIVE_FIELDS) {
    const v = obj[field];
    if (typeof v === "string" && v.startsWith(PREFIX)) {
      try {
        obj[field] = decryptValue(key, v);
      } catch {
        // Wrong API_KEY_SECRET or corrupted value — surface a clearly broken
        // placeholder instead of silently sending garbage upstream.
        obj[field] = "";
        obj[`${field}DecryptionFailed`] = true;
      }
    }
  }
  return obj;
}

export function isEncryptionAvailable() {
  return deriveKey() !== null;
}
