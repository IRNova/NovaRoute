// Roles and route authorisation.
//
// Until now the panel had exactly one identity: whoever knew the password could
// do everything, including minting API keys, restoring the database and
// triggering a code update. These roles let a team share one instance without
// sharing that blast radius.
//
//   admin     everything, including users, keys, database, updates, shutdown
//   operator  day-to-day work: providers, combos, models, usage, agent
//   viewer    read-only
//
// Pure module (no imports) so the matrix is unit-testable on its own.

export const ROLES = ["admin", "operator", "viewer"];
export const DEFAULT_ROLE = "operator";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Paths only an admin may write to. Anything that mints credentials, changes
// who can log in, moves the database, or runs code on the host.
const ADMIN_ONLY_PREFIXES = [
  "/api/users",
  "/api/keys",
  "/api/auth/change-password",
  "/api/auth/reset-password",
  "/api/auth/2fa",
  "/api/auth/revoke-sessions",
  "/api/auth/sessions",
  "/api/security",
  "/api/settings/database",
  "/api/setup",
  "/api/shutdown",
  "/api/version/update",
  "/api/version/shutdown",
  "/api/github-update",
  "/api/oauth",
  "/api/tunnel",
  "/api/tunnels",
  "/api/cli-tools",
  "/api/mcp",
  "/api/headroom",
  "/api/plugins",
  "/api/marketplace",
];

// Reads that leak credentials or host state: admin-only even for GET.
const ADMIN_ONLY_READ_PREFIXES = [
  "/api/users",
  "/api/keys",
  "/api/security",
  "/api/settings/database",
  "/api/auth/sessions",
];

export function isValidRole(role) {
  return ROLES.includes(String(role));
}

export function normalizeRole(role) {
  return isValidRole(role) ? String(role) : DEFAULT_ROLE;
}

function matches(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * May this role perform `method` on `pathname`?
 *
 * Anything not under /api/ (dashboard pages, the gateway itself) is not this
 * function's business and returns true — the guard handles those separately.
 *
 * @param {string} role
 * @param {string} method
 * @param {string} pathname
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canAccess(role, method, pathname) {
  const normalizedRole = normalizeRole(role);
  const verb = String(method || "GET").toUpperCase();
  const path = String(pathname || "");

  if (!path.startsWith("/api/")) return { allowed: true };
  if (normalizedRole === "admin") return { allowed: true };

  const isRead = READ_METHODS.has(verb);

  if (matches(path, ADMIN_ONLY_READ_PREFIXES) || (!isRead && matches(path, ADMIN_ONLY_PREFIXES))) {
    return { allowed: false, reason: `This action requires the admin role (you are ${normalizedRole})` };
  }

  if (normalizedRole === "viewer" && !isRead) {
    return { allowed: false, reason: "Your account is read-only (viewer role)" };
  }

  return { allowed: true };
}

/** Human-readable summary, for the dashboard. */
export function describeRole(role) {
  switch (normalizeRole(role)) {
    case "admin":
      return "Full access, including users, API keys, database and updates.";
    case "operator":
      return "Day-to-day operations: providers, combos, models, usage and the agent. No users, keys, database or updates.";
    default:
      return "Read-only access to the dashboard.";
  }
}
