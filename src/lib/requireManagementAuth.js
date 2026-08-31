import { NextResponse } from "next/server";
import { getApiKeyMetadata } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { verifyDashboardAuthToken } from "@/lib/auth/dashboardSession";
import { timingSafeEqualStr } from "@/lib/auth/timingSafe";
import { extractApiKey } from "@/sse/services/auth.js";

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";

export const MANAGE_SCOPE = "manage";
export const ADMIN_SCOPE = "admin";
// Scopes that count as full management access (admin is a superset of manage).
export const MANAGEMENT_API_KEY_SCOPES = ["manage", "admin"];

let cachedCliToken = null;
async function getCliToken() {
  if (!cachedCliToken) cachedCliToken = await getConsistentMachineId(CLI_TOKEN_SALT);
  return cachedCliToken;
}

async function hasValidCliToken(request) {
  const token = request.headers.get(CLI_TOKEN_HEADER);
  if (!token) return false;
  return timingSafeEqualStr(token, await getCliToken());
}

async function hasValidSession(request) {
  const token = request.cookies.get("auth_token")?.value;
  return await verifyDashboardAuthToken(token);
}

// Mirrors dashboardGuard: when login is disabled the browser runs without a JWT,
// so management routes must stay usable from the local dashboard — but remote
// anonymous clients are rejected unless explicitly opted in via env.
async function isLocalDashboardAllowed(request) {
  try {
    const { getSettings } = await import("@/lib/localDb");
    const settings = await getSettings();
    if (settings?.requireLogin === false) {
      if (process.env.NR_ALLOW_REMOTE_UNAUTH_API === "1") return true;
      const { isLocalRequest } = await import("@/dashboardGuard");
      return isLocalRequest(request);
    }
  } catch {
    // fail closed on settings error
  }
  return false;
}

function hasRequiredScope(apiKeyInfo, requiredScopes) {
  if (!apiKeyInfo || !Array.isArray(apiKeyInfo.scopes)) return false;
  return apiKeyInfo.scopes.some((s) => requiredScopes.includes(s));
}

/**
 * Guard for management API routes (/api/keys*, key groups, etc.).
 *
 * Access is granted when any of:
 *  - a valid CLI token (machineId-based) is present
 *  - a valid dashboard JWT session cookie is present
 *  - the request is authenticated by an API key carrying a `manage` (or `admin`) scope
 *
 * Returns `null` (→ allow) or a 401/403 NextResponse.
 */
export async function requireManagementAuth(request, { requiredScopes = MANAGEMENT_API_KEY_SCOPES } = {}) {
  try {
    if (await hasValidCliToken(request)) return null;
    if (await hasValidSession(request)) return null;
    if (await isLocalDashboardAllowed(request)) return null;

    const apiKey = extractApiKey(request);
    if (apiKey) {
      const apiKeyInfo = await getApiKeyMetadata(apiKey);
      if (apiKeyInfo && apiKeyInfo.isActive !== false && hasRequiredScope(apiKeyInfo, requiredScopes)) {
        return null;
      }
      if (apiKeyInfo && apiKeyInfo.isActive !== false && apiKeyInfo.scopes?.length) {
        return NextResponse.json(
          { error: "Insufficient API key permissions", required: requiredScopes },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "API key requires a manage scope for this operation" },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * Resolve management-route auth to (optional) key info. Returns a NextResponse
 * on rejection, otherwise the API key info (may be null when authed by CLI/JWT).
 */
export async function resolveManagementAuth(request) {
  const rejection = await requireManagementAuth(request);
  if (rejection) return { rejection, apiKeyInfo: null };
  const apiKey = extractApiKey(request);
  const apiKeyInfo = apiKey ? await getApiKeyMetadata(apiKey) : null;
  return { rejection: null, apiKeyInfo };
}
