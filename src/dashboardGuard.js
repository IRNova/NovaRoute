import { NextResponse } from "next/server";
import { getSettings, validateApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { verifyDashboardAuthToken, getDashboardAuthSession } from "@/lib/auth/dashboardSession";
import { canAccess } from "@/lib/auth/roles.js";
import { timingSafeEqualStr } from "@/lib/auth/timingSafe";
import { hasTrustedPeerStamp } from "@/lib/auth/trustedPeer";
import { isIpAutoBanned, recordGatewayAuthFailure } from "@/lib/security/gatewayAutoBan.js";
import { isPrivateAddress } from "@/lib/security/urlGuard.js";
import { shouldAudit, recordAdminAction } from "@/lib/security/adminAudit.js";

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";

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

// Public API paths — no auth required (LLM API has its own key auth inside handler).
const PUBLIC_API_PATHS = [
  "/api/health",
  "/api/init",
  "/api/locale",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/status",
  "/api/auth/oidc",
  "/api/version",
  "/api/public-status",
  "/api/settings/require-login",
  "/api/setup",
  "/api/providers/default-models",
  // Prometheus cannot carry a dashboard session. The route itself is
  // fail-closed: it needs METRICS_TOKEN or full management auth, so the guard
  // only has to let the request reach it.
  "/api/metrics",
  // Telegram webhook deliveries. The global guard must NOT answer these —
  // they are authenticated inside the handler via the
  // X-Telegram-Bot-Api-Secret-Token header instead.
  "/api/dashboard/nova/telegram/webhook",
  // Inbound messages for generic webhook channels: authenticated inside the
  // handler with the channel's own secret (X-Channel-Secret).
  "/api/channels/webhook",
];

// Public top-level prefixes (LLM API endpoints with their own API key auth).
const PUBLIC_PREFIXES = ["/v1", "/v1beta", "/api/v1", "/api/v1beta", "/codex"];

// Always require JWT token regardless of requireLogin setting
const ALWAYS_PROTECTED = [
  "/api/shutdown",
  // Pulls code, rebuilds and restarts the service. It lives under the public
  // /api/setup prefix, so without this it was reachable unauthenticated (the
  // route's own localhost check was the only gate).
  "/api/setup/update",
  "/api/settings/database",
  "/api/version/shutdown",
  "/api/version/update",
  "/api/oauth/cursor/auto-import",
  "/api/oauth/kiro/auto-import",
];

// Require auth, but allow through if requireLogin is disabled
const PROTECTED_API_PATHS = [
  "/api/settings",
  "/api/keys",
  "/api/providers",
  "/api/provider-nodes",
  "/api/proxy-pools",
  "/api/combos",
  "/api/models",
  "/api/usage",
  "/api/oauth",
  "/api/cloud",
  "/api/media-providers",
  "/api/pricing",
  "/api/tags",
  "/api/cli-tools",
  "/api/mcp",
  "/api/translator",
  "/api/tunnel",
];

// Routes that spawn child processes or read host secrets — restrict to localhost.
const LOCAL_ONLY_PATHS = [
  "/api/cli-tools/cowork-settings",
  "/api/cli-tools/antigravity-mitm",
  "/api/mcp/",
  "/api/tunnel/tailscale-install",
  "/api/tunnel/tailscale-enable",
  "/api/tunnel/tailscale-disable",
  "/api/tunnel/tailscale-check",
  "/api/tunnel/enable",
  "/api/tunnel/disable",
  "/api/oauth/cursor/auto-import",
  "/api/oauth/kiro/auto-import",
  "/api/auth/reset-password",
  "/api/headroom/start",
  "/api/headroom/stop",
  "/api/headroom/proxy",
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackHostname(h) {
  if (!h) return false;
  const name = h.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  return LOOPBACK_HOSTS.has(name);
}

export function isLocalRequest(request) {
  // Stamped by custom-server.js when forwarding headers exist: request came through
  // a reverse proxy, so the loopback socket is the proxy hop, not the end-user.
  if (request.headers.get("x-9r-via-proxy")) return false;
  // In production, peer info (x-9r-real-ip) is only trusted when it was stamped
  // by our own wrapper — otherwise a direct client could forge it. Fail closed
  // when the wrapper is not in the serving path. Dev keeps the legacy fallback.
  if (!hasTrustedPeerStamp(request) && process.env.NODE_ENV === "production") {
    return false;
  }
  // Trusted peer IP from TCP socket (custom-server.js); unspoofable when stamped.
  const realIp = request.headers.get("x-9r-real-ip");
  if (realIp) {
    if (!isLoopbackHostname(realIp)) return false;
  } else if (!isLoopbackHostname(request.headers.get("host"))) {
    // Fallback for bare server.js (dev) without custom-server: legacy Host-based check.
    return false;
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (!isLoopbackHostname(new URL(origin).hostname)) return false;
    } catch { return false; }
  }
  return true;
}

function isPublicLlmApi(pathname) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function extractApiKey(request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) return apiKeyHeader;
  const googleApiKeyHeader = request.headers.get("x-goog-api-key");
  if (googleApiKeyHeader) return googleApiKeyHeader;
  return request.nextUrl.searchParams?.get("key") || null;
}

async function hasValidApiKey(request) {
  const apiKey = extractApiKey(request);
  if (!apiKey) return false;
  if (await validateApiKey(apiKey)) return true;
  // Virtual keys (sk-novaroute-*) are valid gateway credentials too.
  if (typeof apiKey === "string" && apiKey.startsWith("sk-novaroute-")) {
    try {
      const { getVirtualKeyManager } = await import("@/lib/virtualKeys/virtualKeyManager.js");
      const manager = getVirtualKeyManager();
      await manager.ensureLoaded();
      if (manager.validate(apiKey)?.valid) return true;
    } catch {}
  }
  return false;
}

// Loopback and RFC1918/CGNAT/link-local peers. Used to decide whether "no API
// key required" may apply: a LAN instance stays convenient, an internet-facing
// one does not hand its provider credits to the first scanner that finds it.
// isPrivateAddress() is the same classifier the SSRF guard uses.
export function isPrivateNetworkIp(ip) {
  const raw = String(ip || "").trim();
  if (!raw) return false;
  return isPrivateAddress(raw);
}

async function canAccessPublicLlmApi(request) {
  if (isLocalRequest(request)) return true;
  if (await hasValidCliToken(request)) return true;
  try {
    const settings = await getSettings();
    if (settings && settings.requireApiKey === false) {
      // "No API key" must not mean "open to the internet". Anonymous callers
      // are accepted from loopback/private networks only, unless the operator
      // explicitly opts a public instance in.
      if (process.env.NR_ALLOW_ANONYMOUS_REMOTE_API === "1") return true;
      if (isPrivateNetworkIp(request.headers.get("x-9r-real-ip"))) return true;
      // Fall through: a valid API key still gets in.
    }
  } catch {}
  return await hasValidApiKey(request);
}

async function canAccessLocalOnlyRoute(request) {
  if (await hasValidCliToken(request)) return true;
  // Browser on host: loopback Host + Origin (blocks tunnel/CSRF) + auth (JWT or requireLogin=false)
  if (isLocalRequest(request) && await isAuthenticated(request)) return true;
  return false;
}

async function hasValidToken(request) {
  const token = request.cookies.get("auth_token")?.value;
  return await verifyDashboardAuthToken(token);
}

// Read settings directly from DB to avoid self-fetch deadlock in proxy
async function loadSettings() {
  try {
    return await getSettings();
  } catch {
    return null;
  }
}

async function isAuthenticated(request) {
  if (await hasValidToken(request)) return true;
  const settings = await loadSettings();
  if (settings && settings.requireLogin === false) {
    // Login-free mode must not silently expose management APIs to remote,
    // anonymous clients — restrict it to local requests unless explicitly
    // opted in via NR_ALLOW_REMOTE_UNAUTH_API=1.
    if (process.env.NR_ALLOW_REMOTE_UNAUTH_API === "1") return true;
    return isLocalRequest(request);
  }
  return false;
}

function isPublicApi(pathname) {
  if (isPublicLlmApi(pathname)) return true;
  return PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const __test__ = {
  isLocalRequest,
  isPrivateNetworkIp,
  isPublicLlmApi,
  extractApiKey,
  canAccessPublicLlmApi,
  canAccessLocalOnlyRoute,
};

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Gateway auto-ban: cut off IPs that repeatedly failed /v1 authentication
  // (and manually blocked ones synced through the same store). Fail-open.
  try {
    const peerIp = request.headers.get("x-9r-real-ip") || "";
    if (peerIp && (await isIpAutoBanned(peerIp))) {
      return NextResponse.json({ error: "IP blocked due to repeated unauthorized access" }, { status: 403 });
    }
  } catch {}

  // Local-only gate for spawn-capable / host-secret routes.
  if (LOCAL_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    if (!(await canAccessLocalOnlyRoute(request))) {
      return NextResponse.json({ error: "Local only: CLI token required" }, { status: 403 });
    }
  }

  // Always protected - require valid JWT or local CLI token (machineId-based)
  if (ALWAYS_PROTECTED.some((p) => pathname.startsWith(p))) {
    if (await hasValidCliToken(request) || await hasValidToken(request))
      return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isPublicLlmApi(pathname)) {
    if (await canAccessPublicLlmApi(request)) return NextResponse.next();
    // Count the failure toward the gateway auto-ban threshold.
    try {
      const peerIp = request.headers.get("x-9r-real-ip") || "";
      await recordGatewayAuthFailure(peerIp);
    } catch {}
    return NextResponse.json({ error: "API key required for remote API access" }, { status: 401 });
  }

  // Deny-by-default for /api/* — public allow-list bypasses, everything else requires auth.
  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) return NextResponse.next();
    const viaCli = await hasValidCliToken(request);
    if (viaCli || await isAuthenticated(request)) {
      // Role check. The CLI token is the machine owner and is always admin;
      // a session carries its account's role, and a session minted before
      // roles existed has none, which reads as admin (its previous power).
      let actor = viaCli ? "cli-token" : "dashboard-session";
      if (!viaCli) {
        const session = await getDashboardAuthSession(request.cookies.get("auth_token")?.value);
        if (session) {
          actor = session.username ? `${session.username} (${session.role || "admin"})` : actor;
          const verdict = canAccess(session.role || "admin", request.method, pathname);
          if (!verdict.allowed) {
            return NextResponse.json({ error: verdict.reason, code: "forbidden_role" }, { status: 403 });
          }
        }
      }

      // Administrative writes are recorded here, where every management route
      // passes exactly once, rather than in each of the 300-odd handlers.
      if (shouldAudit(request.method, pathname)) {
        void recordAdminAction({
          method: request.method,
          path: pathname,
          actor,
          ip: request.headers.get("x-9r-real-ip") || "",
          userAgent: request.headers.get("user-agent") || "",
        });
      }
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect all dashboard routes
  if (pathname.startsWith("/dashboard")) {
    let requireLogin = true;
    let tunnelDashboardAccess = true;

    try {
      const settings = await loadSettings();
      if (settings) {
        requireLogin = settings.requireLogin !== false;
        tunnelDashboardAccess = settings.tunnelDashboardAccess === true;

        // Block tunnel/tailscale access if disabled (redirect to login)
        if (!tunnelDashboardAccess) {
          const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
          const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
          const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
          if ((tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost)) {
            return NextResponse.redirect(new URL("/login", request.url));
          }
        }
      }
    } catch {
      // On error, keep defaults (require login, block tunnel)
    }

    // If login not required, allow through
    if (!requireLogin) return NextResponse.next();

    // Verify JWT token
    const token = request.cookies.get("auth_token")?.value;
    if (token) {
      if (await verifyDashboardAuthToken(token)) {
        return NextResponse.next();
      } else {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect / to /dashboard if logged in, or /dashboard if it's the root
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}
