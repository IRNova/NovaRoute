// Minimal RFC 6238 (TOTP) / RFC 4226 (HOTP) implementation on node:crypto.
// No external dependencies: secrets are Base32-encoded, codes are 6 digits,
// SHA-1 HMAC with a 30-second step — the default authenticator-app profile.
import crypto from "node:crypto";

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function hotp(secretBuf, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuf).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totpNow(secretBase32, { step = 30, atMs = Date.now() } = {}) {
  const counter = Math.floor(atMs / 1000 / step);
  return hotp(base32Decode(secretBase32), counter);
}

/** Verify a code allowing ±1 step of clock drift. Constant-time per candidate. */
export function verifyTotp(code, secretBase32, { step = 30, window = 1, atMs = Date.now() } = {}) {
  if (!/^\d{6}$/.test(String(code || "").trim())) return false;
  const secretBuf = base32Decode(secretBase32);
  if (secretBuf.length === 0) return false;
  const counter = Math.floor(atMs / 1000 / step);
  const provided = String(code).trim();
  for (let drift = -window; drift <= window; drift++) {
    const expected = hotp(secretBuf, counter + drift);
    if (
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
    ) {
      return true;
    }
  }
  return false;
}

export function buildOtpauthUri({ secret, account = "admin", issuer = "NovaRoute" }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer: encodeURIComponent(issuer),
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
