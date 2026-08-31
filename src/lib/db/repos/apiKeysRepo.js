import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

const FLAG_FIELDS = ["noLog", "allowUsageCommand", "usageLimitEnabled"];

export function maskStoredApiKey(key) {
  if (typeof key !== "string") return null;
  if (key.length <= 12) return key.slice(0, 8) + "****" + key.slice(-4);
  return key.slice(0, 8) + "****" + key.slice(-4);
}

function parseFlag(value) {
  return value === 1 || value === true;
}

function parseList(value) {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
  if (typeof value === "string") {
    const parsed = parseJson(value, null);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  }
  return [];
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rowToKey(row) {
  if (!row) return null;
  const scopes = parseList(row.scopes);
  const allowedModels = parseList(row.allowedModels);
  const blockedModels = parseList(row.blockedModels);
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: parseFlag(row.isActive),
    createdAt: row.createdAt,
    scopes,
    noLog: parseFlag(row.noLog),
    allowUsageCommand: parseFlag(row.allowUsageCommand),
    usageLimitEnabled: parseFlag(row.usageLimitEnabled),
    dailyUsageLimitUsd: parseNumber(row.dailyUsageLimitUsd),
    weeklyUsageLimitUsd: parseNumber(row.weeklyUsageLimitUsd),
    allowedModels,
    blockedModels,
    modelAccessMode:
      row.modelAccessMode === "restricted" || allowedModels.length > 0 ? "restricted" : "all",
    // Request-rate controls: null/0 mean "no limit".
    rpmLimit: parseNumber(row.rpmLimit),
    concurrencyLimit: parseNumber(row.concurrencyLimit),
    expiresAt: row.expiresAt || null,
    isExpired: !!(row.expiresAt && new Date(row.expiresAt) < new Date()),
  };
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeysCount() {
  const db = await getAdapter();
  const row = db.get(`SELECT COUNT(*) as c FROM apiKeys`);
  return row?.c || 0;
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function getApiKeyMetadata(key) {
  if (!key || typeof key !== "string") return null;
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, scopes = [], options = {}) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    createdAt: new Date().toISOString(),
    scopes: Array.isArray(scopes) ? [...scopes] : [],
    noLog: !!options.noLog,
    allowUsageCommand: !!options.allowUsageCommand,
    usageLimitEnabled: !!options.usageLimitEnabled,
    dailyUsageLimitUsd: parseNumber(options.dailyUsageLimitUsd),
    weeklyUsageLimitUsd: parseNumber(options.weeklyUsageLimitUsd),
    allowedModels: Array.isArray(options.allowedModels) ? [...options.allowedModels] : [],
    blockedModels: Array.isArray(options.blockedModels) ? [...options.blockedModels] : [],
    modelAccessMode: options.modelAccessMode || "all",
    rpmLimit: parseNumber(options.rpmLimit),
    concurrencyLimit: parseNumber(options.concurrencyLimit),
    expiresAt: options.expiresAt || null,
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt, scopes, noLog, allowUsageCommand, usageLimitEnabled, dailyUsageLimitUsd, weeklyUsageLimitUsd, allowedModels, blockedModels, modelAccessMode, rpmLimit, concurrencyLimit, expiresAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, apiKey.createdAt,
      stringifyJson(apiKey.scopes),
      apiKey.noLog ? 1 : 0,
      apiKey.allowUsageCommand ? 1 : 0,
      apiKey.usageLimitEnabled ? 1 : 0,
      apiKey.dailyUsageLimitUsd,
      apiKey.weeklyUsageLimitUsd,
      stringifyJson(apiKey.allowedModels),
      stringifyJson(apiKey.blockedModels),
      apiKey.modelAccessMode,
      apiKey.rpmLimit,
      apiKey.concurrencyLimit,
      apiKey.expiresAt,
    ]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const merged = { ...rowToKey(row), ...data };
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, scopes = ?, noLog = ?, allowUsageCommand = ?, usageLimitEnabled = ?, dailyUsageLimitUsd = ?, weeklyUsageLimitUsd = ?, allowedModels = ?, blockedModels = ?, modelAccessMode = ?, rpmLimit = ?, concurrencyLimit = ?, expiresAt = ? WHERE id = ?`,
      [
        merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0,
        stringifyJson(merged.scopes || []),
        merged.noLog ? 1 : 0,
        merged.allowUsageCommand ? 1 : 0,
        merged.usageLimitEnabled ? 1 : 0,
        merged.dailyUsageLimitUsd ?? null,
        merged.weeklyUsageLimitUsd ?? null,
        stringifyJson(merged.allowedModels || []),
        stringifyJson(merged.blockedModels || []),
        merged.modelAccessMode || "all",
        merged.rpmLimit ?? null,
        merged.concurrencyLimit ?? null,
        merged.expiresAt ?? null,
        id,
      ]
    );
    result = merged;
  });
  return result;
}

export async function updateApiKeyPermissions(id, update) {
  const db = await getAdapter();
  const existing = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  if (!existing) return null;
  const merged = { ...rowToKey(existing), ...update };
  db.run(
    `UPDATE apiKeys SET name = ?, scopes = ?, noLog = ?, allowUsageCommand = ?, usageLimitEnabled = ?, dailyUsageLimitUsd = ?, weeklyUsageLimitUsd = ?, allowedModels = ?, blockedModels = ?, modelAccessMode = ?, rpmLimit = ?, concurrencyLimit = ? WHERE id = ?`,
    [
      merged.name ?? null,
      stringifyJson(merged.scopes || []),
      merged.noLog ? 1 : 0,
      merged.allowUsageCommand ? 1 : 0,
      merged.usageLimitEnabled ? 1 : 0,
      merged.dailyUsageLimitUsd ?? null,
      merged.weeklyUsageLimitUsd ?? null,
      stringifyJson(merged.allowedModels || []),
      stringifyJson(merged.blockedModels || []),
      merged.modelAccessMode || "all",
      merged.rpmLimit ?? null,
      merged.concurrencyLimit ?? null,
      id,
    ]
  );
  return { ...merged, key: undefined };
}

export async function regenerateApiKey(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  if (!row) return null;
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const machineId = row.machineId || (await (await import("@/shared/utils/machineId")).getConsistentMachineId());
  const result = generateApiKeyWithMachine(machineId);
  db.run(`UPDATE apiKeys SET key = ? WHERE id = ?`, [result.key, id]);
  const updated = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(updated);
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT isActive, expiresAt FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  if (!parseFlag(row.isActive)) return false;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return false;
  return true;
}

// Small TTL cache so the noLog lookup doesn't hit the DB on every request.
const noLogCache = new Map();
const NO_LOG_CACHE_TTL_MS = 60_000;

export function invalidateNoLogCache(key) {
  if (key === undefined) noLogCache.clear();
  else noLogCache.delete(key);
}

/**
 * True when a key is configured with noLog (usage logging suppressed).
 * Fail-open: returns false on any error so logging is never accidentally lost.
 */
export async function isNoLogApiKey(key) {
  if (!key || typeof key !== "string") return false;
  const cached = noLogCache.get(key);
  if (cached !== undefined) return cached;
  let noLog = false;
  try {
    const info = await getApiKeyMetadata(key);
    noLog = !!info?.noLog;
  } catch {
    noLog = false;
  }
  noLogCache.set(key, noLog);
  const ttl = setTimeout(() => noLogCache.delete(key), NO_LOG_CACHE_TTL_MS);
  if (typeof ttl?.unref === "function") ttl.unref();
  return noLog;
}

export { FLAG_FIELDS };
