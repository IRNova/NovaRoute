// Deterministic status derivation for the providers page.
//
// The multi-state light reflects the best available signal without live-fetching
// quota for every provider on mount (that would fire a real upstream call per
// connection). It reads the fields the runtime already persists on each
// connection after tests / refreshes / failures: testStatus, lastErrorType,
// errorCode, lastError and rateLimitedUntil.
//
// States:
//   disabled     — user turned the provider off (all connections inactive)
//   exhausted    — token/quota spent for the day (red light)
//   broken       — connection dropped / upstream down (orange light)
//   connected    — active connection with a working test (green light)
//   notConnected — no connections / nothing wired (colourless light)
//   unknown      — has active connections but none tested yet (grey light)

const EXHAUSTED_RE =
  /quota|exhausted|rate\s*-?\s*limit|limit\s*(reached|exceed(ed)?)|daily\s*limit|monthly\s*limit|tokens?\s*(exhaust(ed)?|exceed(ed)?|finish(ed)?|run\s*out|spent)|billing|insufficient\s*credits|no\s*more\s*requests/i;

export function isQuotaExhausted(conn) {
  if (!conn) return false;
  if (conn.testStatus === "expired") return true;
  if (
    conn.lastErrorType === "token_expired" ||
    conn.lastErrorType === "token_refresh_failed"
  )
    return true;
  if (String(conn.errorCode) === "429") return true;
  if (conn.lastErrorType === "upstream_rate_limited") return true;
  if (
    conn.rateLimitedUntil &&
    new Date(conn.rateLimitedUntil).getTime() > Date.now()
  )
    return true;
  const msg = (conn.lastError || "").toLowerCase();
  return EXHAUSTED_RE.test(msg);
}

const BROKEN_TYPES = new Set([
  "network_error",
  "upstream_unavailable",
  "runtime_error",
  "upstream_auth_error",
  "auth_missing",
]);

export function isBroken(conn) {
  if (!conn) return false;
  if (conn.testStatus === "error" || conn.testStatus === "unavailable")
    return true;
  if (BROKEN_TYPES.has(conn.lastErrorType)) return true;
  const code = Number(conn.errorCode);
  if (Number.isFinite(code) && code >= 500) return true;
  return false;
}

export function isConnected(conn) {
  return conn.testStatus === "active" || conn.testStatus === "success";
}

// Visual metadata for each state. `accent` paints the card's leading edge.
export const STATUS_META = {
  connected: {
    dot: "bg-emerald-500",
    glow: "shadow-[0_0_8px_rgba(16,185,129,0.9)]",
    text: "text-emerald-600 dark:text-emerald-400",
    accent: "border-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    label: "Active",
  },
  exhausted: {
    dot: "bg-red-500",
    glow: "shadow-[0_0_8px_rgba(239,68,68,0.9)]",
    text: "text-red-600 dark:text-red-400",
    accent: "border-red-500",
    chip: "bg-red-500/10 text-red-700 dark:text-red-300",
    label: "Quota exhausted",
  },
  broken: {
    dot: "bg-amber-500",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.9)]",
    text: "text-amber-600 dark:text-amber-400",
    accent: "border-amber-500",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    label: "Connection down",
  },
  notConnected: {
    dot: "bg-neutral-300 dark:bg-neutral-600",
    glow: "",
    text: "text-text-muted",
    accent: "border-neutral-300 dark:border-neutral-700",
    chip: "bg-surface-2 text-text-muted",
    label: "Not connected",
  },
  unknown: {
    dot: "bg-neutral-400 dark:bg-neutral-500",
    glow: "",
    text: "text-text-muted",
    accent: "border-neutral-400 dark:border-neutral-600",
    chip: "bg-surface-2 text-text-muted",
    label: "Untested",
  },
  disabled: {
    dot: "bg-neutral-200 dark:bg-neutral-700",
    glow: "",
    text: "text-text-muted",
    accent: "border-neutral-300 dark:border-neutral-800",
    chip: "bg-surface-2 text-text-muted",
    label: "Disabled",
  },
};

export function getProviderState(providerId, connections) {
  const conns = connections.filter((c) => c.provider === providerId);
  const total = conns.length;
  const activeConns = conns.filter((c) => c.isActive !== false);

  if (total > 0 && activeConns.length === 0) {
    return { state: "disabled", label: STATUS_META.disabled.label, connections: conns };
  }
  if (total === 0) {
    return { state: "notConnected", label: STATUS_META.notConnected.label, connections: conns };
  }

  if (activeConns.some(isQuotaExhausted)) {
    return { state: "exhausted", label: STATUS_META.exhausted.label, connections: conns };
  }
  if (activeConns.some(isBroken)) {
    return { state: "broken", label: STATUS_META.broken.label, connections: conns };
  }
  if (activeConns.some(isConnected)) {
    return { state: "connected", label: STATUS_META.connected.label, connections: conns };
  }

  return { state: "unknown", label: STATUS_META.unknown.label, connections: conns };
}
