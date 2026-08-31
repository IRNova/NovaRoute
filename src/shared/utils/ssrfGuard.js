// SSRF guard: block internal/private/metadata targets for server-side fetch.

const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);
const BLOCKED_SUFFIXES = [".internal", ".local", ".localhost"];

// Parse a single inet_aton token: decimal, 0x hex, or 0-prefixed octal.
function parseIpToken(part) {
  if (/^0[xX][0-9a-fA-F]+$/.test(part)) {
    const value = Number.parseInt(part.slice(2), 16);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (/^0[0-7]+$/.test(part)) {
    const value = Number.parseInt(part.slice(1), 8);
    return Number.isSafeInteger(value) ? value : null;
  }
  if (/^\d+$/.test(part)) {
    const value = Number(part);
    return Number.isSafeInteger(value) ? value : null;
  }
  return null;
}

// inet_aton-style IPv4 literal parsing: accepts 1-4 parts, decimal/hex/octal,
// with the classic short forms ("127.1", "0x7f000001", "2130706433"). Returns
// a 32-bit unsigned integer, or null if the host is not such a literal.
function ipv4LiteralToInt(host) {
  const parts = host.split(".");
  if (!host || parts.length > 4) return null;
  const values = [];
  for (const part of parts) {
    const value = parseIpToken(part);
    if (value === null) return null;
    values.push(value);
  }
  // Leading parts must each fit one byte; the last part fills the remainder.
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] > 255) return null;
  }
  const lastMax = Math.pow(2, 8 * (5 - values.length));
  if (values[values.length - 1] >= lastMax) return null;
  let value = values[values.length - 1];
  for (let i = values.length - 2; i >= 0; i--) {
    value += values[i] * Math.pow(256, values.length - 1 - i);
  }
  return value <= 0xffffffff ? value >>> 0 : null;
}

// Strict dotted quad (used for IPv4 embedded in IPv6).
function dottedQuadToInt(host) {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

// Private/reserved IPv4 ranges as [startInt, maskBits].
const BLOCKED_V4_RANGES = [
  [dottedQuadToInt("0.0.0.0"), 8],
  [dottedQuadToInt("10.0.0.0"), 8],
  [dottedQuadToInt("100.64.0.0"), 10], // CGNAT / Tailscale tailnet
  [dottedQuadToInt("127.0.0.0"), 8],
  [dottedQuadToInt("169.254.0.0"), 16],
  [dottedQuadToInt("172.16.0.0"), 12],
  [dottedQuadToInt("192.168.0.0"), 16],
];

function isBlockedIpv4Value(ip) {
  if (ip === null) return false;
  return BLOCKED_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((ip & mask) === (base & mask));
  });
}

function isBlockedIpv4(host) {
  return isBlockedIpv4Value(ipv4LiteralToInt(host));
}

function isBlockedIpv6(host) {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  // IPv4-mapped/compatible forms: "::ffff:127.0.0.1", "::ffff:7f00:1", "::127.0.0.1".
  const v4MappedDotted = h.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (v4MappedDotted) return isBlockedIpv4Value(dottedQuadToInt(v4MappedDotted[1]));
  const v4MappedHex = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4MappedHex) {
    const hi = Number.parseInt(v4MappedHex[1], 16);
    const lo = Number.parseInt(v4MappedHex[2], 16);
    return isBlockedIpv4Value((((hi << 16) | lo) >>> 0));
  }
  if (h === "::1" || h === "::") return true;
  return h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd");
}

// Throw if URL targets a non-public host. Caller should map to 400.
export function assertPublicUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname.toLowerCase();

  if (!host) throw new Error("Blocked URL: empty host");
  if (BLOCKED_HOSTNAMES.has(host)) throw new Error("Blocked URL: internal host");
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new Error("Blocked URL: internal host");
  if (isBlockedIpv4(host)) throw new Error("Blocked URL: private IP");
  // Any host made purely of IP-literal characters goes through the literal
  // parsers above; anything left containing ":" is treated as IPv6.
  if (host.includes(":") && isBlockedIpv6(host)) throw new Error("Blocked URL: private IP");
}
