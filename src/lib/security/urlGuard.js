// URL/SSRF guard shared by the agent tools, skill import and media fetch.
//
// A hostname check alone is not an SSRF guard: 2130706433, 0x7f000001 and
// 127.1 are all "127.0.0.1", a name can resolve to a private address, and a
// public URL can 302 straight into the LAN. isUrlSafe() does the cheap
// syntactic pass; isUrlSafeResolved() adds DNS; fetchSafely() re-checks every
// redirect hop.
//
// No app imports here on purpose — this module is unit-tested standalone.

const PRIVATE_V4 = [
  [0, 8],           // 0.0.0.0/8
  [10, 8],          // 10.0.0.0/8
  [100 << 24 | 64 << 16, 10], // 100.64.0.0/10
  [127, 8],         // loopback
  [169 << 24 | 254 << 16, 16], // link-local
  [172 << 24 | 16 << 16, 12],
  [192 << 24 | 168 << 16, 16],
  [192 << 24 | 0 << 16 | 0 << 8, 24], // 192.0.0.0/24
  [198 << 24 | 18 << 16, 15], // benchmarking
  [224, 4],         // multicast
  [240, 4],         // reserved
];

function v4ToInt(a, b, c, d) {
  return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
}

/** Parse the many legal spellings of an IPv4 literal; null when not one. */
export function parseIpv4(host) {
  const parts = String(host).split(".");
  if (parts.length > 4 || parts.length === 0) return null;

  const nums = [];
  for (const part of parts) {
    if (part === "") return null;
    let n;
    if (/^0[xX][0-9a-fA-F]+$/.test(part)) n = Number.parseInt(part, 16);
    else if (/^0[0-7]+$/.test(part)) n = Number.parseInt(part, 8);
    else if (/^\d+$/.test(part)) n = Number.parseInt(part, 10);
    else return null;
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }

  // 1..4 parts: the last part fills the remaining bytes (inet_aton rules).
  const maxLast = 2 ** (8 * (4 - nums.length + 1));
  if (nums.slice(0, -1).some((n) => n > 255)) return null;
  if (nums[nums.length - 1] >= maxLast) return null;

  let value = 0;
  for (let i = 0; i < nums.length - 1; i++) value += nums[i] * 2 ** (8 * (3 - i));
  value += nums[nums.length - 1];
  return value >>> 0;
}

function isPrivateV4Int(value) {
  return PRIVATE_V4.some(([base, bits]) => {
    const netBase = bits <= 8 ? (base << 24) >>> 0 : base >>> 0;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (netBase & mask) >>> 0;
  });
}

/** True when an IP literal (v4 in any notation, or v6) points somewhere internal. */
export function isPrivateAddress(host) {
  const raw = String(host || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!raw) return true;

  if (raw.includes(":")) {
    // IPv6 (including ::ffff:127.0.0.1 style mappings).
    if (raw === "::1" || raw === "::" || raw === "::0") return true;
    if (/^f[cd][0-9a-f]{2}:/.test(raw)) return true; // unique-local
    if (/^fe[89ab][0-9a-f]:/.test(raw)) return true; // link-local
    // ::ffff:127.0.0.1 — WHATWG URL normalises this to ::ffff:7f00:1, so both
    // the dotted and the hex spelling have to be understood.
    const mappedDotted = raw.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedDotted) return isPrivateAddress(mappedDotted[1]);
    const mappedHex = raw.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const value = (((Number.parseInt(mappedHex[1], 16) << 16) >>> 0) + Number.parseInt(mappedHex[2], 16)) >>> 0;
      return isPrivateV4Int(value);
    }
    return false;
  }

  const v4 = parseIpv4(raw);
  if (v4 === null) return false; // not an IP literal
  return isPrivateV4Int(v4);
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".internal", ".local", ".home.arpa"];

export function isUrlSafe(rawUrl) {
  try {
    const u = new URL(String(rawUrl));
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (!host) return false;
    if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return false;
    if (host === "metadata.google.internal" || host === "metadata.goog") return false;
    if (isPrivateAddress(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * isUrlSafe + DNS: rejects names that resolve into private space (the usual
 * "my-evil-host.com A 127.0.0.1" trick). Returns { ok, reason }.
 */
export async function isUrlSafeResolved(rawUrl) {
  if (!isUrlSafe(rawUrl)) return { ok: false, reason: "blocked URL (internal/private network addresses are not allowed)" };
  let host;
  try {
    host = new URL(String(rawUrl)).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  // An IP literal was already checked syntactically.
  if (isPrivateAddress(host) === false && /^[0-9.]+$/.test(host)) return { ok: true };
  try {
    const { lookup } = await import("node:dns/promises");
    const records = await lookup(host, { all: true });
    if (!records.length) return { ok: false, reason: "host does not resolve" };
    for (const record of records) {
      if (isPrivateAddress(record.address)) {
        return { ok: false, reason: "host resolves to a private address" };
      }
    }
  } catch {
    return { ok: false, reason: "host does not resolve" };
  }
  return { ok: true };
}

/**
 * Fetch that re-checks every redirect hop. `undici` would happily follow a
 * 302 from a public URL to http://127.0.0.1:20128/api/…, so redirects are
 * handled here instead of by the client.
 */
export async function fetchSafely(url, { headers = {}, timeoutMs = 20_000, maxRedirects = 4 } = {}) {
  const { default: undiciFetch } = await import("undici");
  let current = String(url);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await isUrlSafeResolved(current);
    if (!check.ok) throw new Error(check.reason);

    const res = await undiciFetch(current, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    });

    const status = res.statusCode ?? res.status;
    const location = res.headers?.location || res.headers?.get?.("location");
    if (status >= 300 && status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return { res, url: current };
  }
  throw new Error("too many redirects");
}

