import { NextResponse } from "next/server";
import {
  getApiKeyMetadata,
  checkKeyModelAccess,
} from "@/lib/localDb";
import { extractApiKey } from "@/sse/services/auth.js";
import { getAdapter } from "@/lib/db/driver.js";
import { errorResponse } from "open-sse/utils/error.js";
import { checkKeyRateLimit } from "@/lib/security/keyRateLimiter.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// Usage limits use a fixed local-day window (rolling 24h/7d) so behaviour is
// predictable regardless of provider quota reset semantics.
const DAY_START_HOUR_UTC = 0;

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getDailyWindowStartIso(nowMs = Date.now()) {
  const d = new Date(nowMs - DAY_START_HOUR_UTC * 60 * 60 * 1000);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAY_START_HOUR_UTC, 0, 0, 0)
  ).toISOString();
}

export function getDailyResetAtIso(nowMs = Date.now()) {
  return new Date(Date.parse(getDailyWindowStartIso(nowMs)) + DAY_MS).toISOString();
}

export function getWeeklyWindowStartIso(nowMs = Date.now()) {
  return new Date(nowMs - WEEK_MS).toISOString();
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Sum USD spend for a key since a given timestamp, straight from the
 * persisted usage history (cost is already stored per request).
 */
export async function getApiKeyUsdSpendSince(apiKey, sinceIso) {
  if (!apiKey || !sinceIso) return 0;
  const db = await getAdapter();
  try {
    const row = db.get(
      `SELECT COALESCE(SUM(cost), 0) as total FROM usageHistory WHERE apiKey = ? AND timestamp >= ?`,
      [apiKey, sinceIso]
    );
    return roundUsd(row?.total || 0);
  } catch {
    return 0;
  }
}

export async function getApiKeyUsageLimitStatus(apiKeyInfo) {
  const now = Date.now();
  const dailyLimitUsd = parseNumber(apiKeyInfo?.dailyUsageLimitUsd);
  const weeklyLimitUsd = parseNumber(apiKeyInfo?.weeklyUsageLimitUsd);
  const enabled = apiKeyInfo?.usageLimitEnabled === true;

  const dailyWindowStartIso = getDailyWindowStartIso(now);
  const weeklyWindowStartIso = getWeeklyWindowStartIso(now);

  const [dailySpentUsd, weeklySpentUsd] = await Promise.all([
    getApiKeyUsdSpendSince(apiKeyInfo.key, dailyWindowStartIso),
    getApiKeyUsdSpendSince(apiKeyInfo.key, weeklyWindowStartIso),
  ]);

  return {
    enabled,
    dailyLimitUsd,
    weeklyLimitUsd,
    dailySpentUsd,
    weeklySpentUsd,
    dailyWindowStartIso,
    dailyResetAtIso: getDailyResetAtIso(now),
    weeklyWindowStartIso,
    weeklyResetAtIso: null,
    dailyExceeded: enabled && dailyLimitUsd !== null && dailySpentUsd >= dailyLimitUsd,
    weeklyExceeded: enabled && weeklyLimitUsd !== null && weeklySpentUsd >= weeklyLimitUsd,
  };
}

function formatUsd(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "$0.00";
  return `$${value.toFixed(2)}`;
}

function formatPercent(spent, limit) {
  if (!limit || limit <= 0) return "0%";
  return `${Math.round((spent / limit) * 100)}%`;
}

function formatResetIn(resetAtIso, now = Date.now()) {
  if (!resetAtIso) return "unknown";
  const deltaMs = Date.parse(resetAtIso) - now;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return "now";
  const mins = Math.max(1, Math.ceil(deltaMs / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function buildUsageLimitMessage(status) {
  if (status.dailyExceeded && status.dailyLimitUsd !== null) {
    return `This API key reached its daily USD usage quota (${formatUsd(status.dailySpentUsd)} of ${formatUsd(status.dailyLimitUsd)}, ${formatPercent(status.dailySpentUsd, status.dailyLimitUsd)}). Resets in ${formatResetIn(status.dailyResetAtIso)}. Try again later.`;
  }
  if (status.weeklyExceeded && status.weeklyLimitUsd !== null) {
    return `This API key reached its weekly USD usage quota (${formatUsd(status.weeklySpentUsd)} of ${formatUsd(status.weeklyLimitUsd)}, ${formatPercent(status.weeklySpentUsd, status.weeklyLimitUsd)}). Resets in ${formatResetIn(status.weeklyResetAtIso)}. Try again later.`;
  }
  return "This API key reached its USD usage quota. Try again later.";
}

/**
 * Enforce API key policy for a request. Returns a rejection Response when the
 * key is inactive, lacks model/group access, or has exhausted its USD usage limit.
 *
 * @param {Request} request
 * @param {string|null} modelStr - requested model (for model/group access checks)
 * @param {string|null} provider - resolved provider (optional, used for group rules)
 * @returns {Promise<{apiKey: string|null, apiKeyInfo: object|null, rejection: Response|null}>}
 */
export async function enforceApiKeyPolicy(request, modelStr = null, provider = null) {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return { apiKey: null, apiKeyInfo: null, rejection: null };
  }

  let apiKeyInfo = null;
  try {
    apiKeyInfo = await getApiKeyMetadata(apiKey);
  } catch {
    return {
      apiKey,
      apiKeyInfo: null,
      rejection: errorResponse(503, "API key policy unavailable"),
    };
  }

  // Key not found — let the caller's auth layer decide (requires a valid key to proceed).
  if (!apiKeyInfo) {
    return { apiKey, apiKeyInfo: null, rejection: null };
  }

  if (apiKeyInfo.isActive === false) {
    return { apiKey, apiKeyInfo, rejection: errorResponse(403, "This API key is disabled") };
  }

  // Model/group access (only when the request actually names a model)
  if (modelStr) {
    const restricted =
      apiKeyInfo.modelAccessMode === "restricted" ||
      (Array.isArray(apiKeyInfo.allowedModels) && apiKeyInfo.allowedModels.length > 0);

    if (restricted && !(await isModelAllowedForKey(apiKeyInfo, modelStr))) {
      return {
        apiKey,
        apiKeyInfo,
        rejection: errorResponse(403, `Model "${modelStr}" is not allowed for this API key`),
      };
    }

    const groupAccess = await checkKeyModelAccess(apiKeyInfo.id, modelStr, provider);
    if (!groupAccess.allowed) {
      return {
        apiKey,
        apiKeyInfo,
        rejection: errorResponse(
          403,
          groupAccess.deniedBy
            ? `Model "${modelStr}" is denied for this API key`
            : `Model "${modelStr}" is not allowed for this API key's groups`
        ),
      };
    }
  }

  // Request rate limits (per-minute + concurrency). Checked before the spend
  // query so a key hammering the gateway is turned away cheaply.
  const rate = checkKeyRateLimit(apiKeyInfo);
  if (!rate.allowed) {
    const response = errorResponse(429, rate.reason);
    try {
      response.headers.set("Retry-After", String(rate.retryAfterSeconds || 1));
      if (rate.limit) {
        response.headers.set("X-RateLimit-Limit", String(rate.limit));
        response.headers.set("X-RateLimit-Remaining", "0");
      }
    } catch { /* header set is best-effort */ }
    return { apiKey, apiKeyInfo, rejection: response };
  }

  // USD usage limits
  if (apiKeyInfo.usageLimitEnabled === true) {
    try {
      const status = await getApiKeyUsageLimitStatus(apiKeyInfo);
      if (status.dailyExceeded || status.weeklyExceeded) {
        return {
          apiKey,
          apiKeyInfo,
          rejection: errorResponse(429, buildUsageLimitMessage(status)),
        };
      }
    } catch {
      // Fail-open on limit-check errors (do not block traffic over a stats query).
    }
  }

  return { apiKey, apiKeyInfo, rejection: null };
}

function matchesModelPattern(pattern, model) {
  if (!pattern) return false;
  if (pattern === "*") return true;
  if (pattern.includes("*")) {
    try {
      return new RegExp("^" + pattern.replace(/\*/g, ".*") + "$").test(model);
    } catch {
      return pattern === model;
    }
  }
  return pattern === model;
}

export async function isModelAllowedForKey(apiKeyInfo, model) {
  if (!apiKeyInfo) return false;
  if (apiKeyInfo.modelAccessMode !== "restricted") {
    const blocked = Array.isArray(apiKeyInfo.blockedModels) ? apiKeyInfo.blockedModels : [];
    if (blocked.length === 0) return true;
    return !blocked.some((p) => matchesModelPattern(p, model));
  }
  const allowed = Array.isArray(apiKeyInfo.allowedModels) ? apiKeyInfo.allowedModels : [];
  return allowed.some((p) => matchesModelPattern(p, model));
}

export { NextResponse };
