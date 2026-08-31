import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";
import { kv } from "@/lib/db/helpers/kvStore.js";

const CF_API = "https://api.cloudflare.com/client/v4";

const cfKv = kv("novaCloudflare");

// ── OAuth config ──────────────────────────────────────────────────────────────
// Config is read from DB first, then falls back to environment variables.
const CF_SCOPES = "openid profile email zone:edit zone:read dns:edit dns:read workers:edit workers:read pages:edit pages:read storage:edit storage:read d1:edit d1:read";
const OAUTH_CONFIG_KEY = "oauthConfig";

let _cachedOAuthConfig = null;
let _cacheTs = 0;
const CACHE_TTL = 30_000;

async function loadOAuthConfig() {
  const now = Date.now();
  if (_cachedOAuthConfig && now - _cacheTs < CACHE_TTL) return _cachedOAuthConfig;
  try {
    const stored = await cfKv.get(OAUTH_CONFIG_KEY);
    _cachedOAuthConfig = stored && typeof stored === "object" ? stored : null;
    _cacheTs = now;
  } catch { _cachedOAuthConfig = null; }
  return _cachedOAuthConfig;
}

export async function getCloudflareConfig() {
  const db = await loadOAuthConfig();
  return {
    clientId: db?.clientId || process.env.CLOUDFLARE_CLIENT_ID || "",
    clientSecret: db?.clientSecret || process.env.CLOUDFLARE_CLIENT_SECRET || "",
    scopes: db?.scopes || CF_SCOPES,
    hasClientSecret: Boolean(db?.clientSecret || process.env.CLOUDFLARE_CLIENT_SECRET),
  };
}

export async function saveCloudflareOAuthConfig({ clientId, clientSecret }) {
  const patch = {};
  if (clientId !== undefined) patch.clientId = clientId;
  if (clientSecret !== undefined) patch.clientSecret = clientSecret;
  await cfKv.set(OAUTH_CONFIG_KEY, patch);
  _cachedOAuthConfig = null;
  _cacheTs = 0;
  return patch;
}

export async function getCloudflareConnection() {
  const conns = await getProviderConnections({ provider: "cloudflare", isActive: true });
  return conns[0] || null;
}

export async function getCloudflareToken() {
  const conn = await getCloudflareConnection();
  if (!conn?.accessToken) return null;
  return conn.accessToken;
}

export async function getCloudflareUser() {
  return cfKv.get("user") || null;
}

async function cfFetch(path, options = {}) {
  const token = await getCloudflareToken();
  if (!token) throw new Error("Cloudflare not connected — connect your account first");

  const url = path.startsWith("http") ? path : `${CF_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.message || `Cloudflare API error ${res.status}`);
  }

  if (data && !data.success) {
    throw new Error(data.errors?.[0]?.message || "Cloudflare API request failed");
  }

  return data;
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function fetchAndStoreUser() {
  const data = await cfFetch("/user");
  const user = data.result;
  await cfKv.set("user", {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
  });
  return user;
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function listAccounts({ page = 1, perPage = 20 } = {}) {
  const data = await cfFetch(`/accounts?page=${page}&per_page=${perPage}`);
  return data.result;
}

export async function getAccount(accountId) {
  const data = await cfFetch(`/accounts/${accountId}`);
  return data.result;
}

// ── Zones (Domains) ──────────────────────────────────────────────────────────

export async function listZones({ page = 1, perPage = 20, status = "active" } = {}) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (status) params.set("status", status);
  const data = await cfFetch(`/zones?${params}`);
  return data.result;
}

export async function getZone(zoneId) {
  const data = await cfFetch(`/zones/${zoneId}`);
  return data.result;
}

export async function createZone({ name, accountId, jumpStart = true }) {
  const data = await cfFetch("/zones", {
    method: "POST",
    body: JSON.stringify({ name, account: { id: accountId }, jump_start: jumpStart }),
  });
  return data.result;
}

export async function deleteZone(zoneId) {
  const data = await cfFetch(`/zones/${zoneId}`, { method: "DELETE" });
  return data;
}

// ── DNS Records ───────────────────────────────────────────────────────────────

export async function listDNSRecords(zoneId, { type, name, page = 1, perPage = 50 } = {}) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (type) params.set("type", type);
  if (name) params.set("name", name);
  const data = await cfFetch(`/zones/${zoneId}/dns_records?${params}`);
  return data.result;
}

export async function getDNSRecord(zoneId, recordId) {
  const data = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`);
  return data.result;
}

export async function createDNSRecord(zoneId, { type, name, content, ttl = 1, proxied = false, priority }) {
  const body = { type, name, content, ttl, proxied };
  if (priority !== undefined) body.priority = priority;
  const data = await cfFetch(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.result;
}

export async function updateDNSRecord(zoneId, recordId, { type, name, content, ttl = 1, proxied = false }) {
  const data = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
    method: "PUT",
    body: JSON.stringify({ type, name, content, ttl, proxied }),
  });
  return data.result;
}

export async function deleteDNSRecord(zoneId, recordId) {
  const data = await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, { method: "DELETE" });
  return data;
}

// ── Workers ───────────────────────────────────────────────────────────────────

export async function listWorkers({ page = 1, perPage = 25 } = {}) {
  const data = await cfFetch(`/accounts/workers/scripts?page=${page}&per_page=${perPage}`);
  return data.result;
}

export async function getWorker(accountId, scriptName) {
  const data = await cfFetch(`/accounts/${accountId}/workers/scripts/${scriptName}`);
  return data;
}

export async function deployWorker(accountId, scriptName, content, { bindings = [], compatibilityDate } = {}) {
  const metadata = { bindings, compatibility_date: compatibilityDate || new Date().toISOString().split("T")[0] };
  const body = new FormData();
  body.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  body.append("file", new Blob([content], { type: "application/javascript+module" }), "index.js");

  const token = await getCloudflareToken();
  const res = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${scriptName}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.errors?.[0]?.message || "Worker deploy failed");
  return data.result;
}

export async function deleteWorker(accountId, scriptName) {
  await cfFetch(`/accounts/${accountId}/workers/scripts/${scriptName}`, { method: "DELETE" });
}

export async function getWorkerSubdomain(accountId) {
  const data = await cfFetch(`/accounts/${accountId}/workers/subdomain`);
  return data.result;
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export async function listPagesProjects({ page = 1, perPage = 25 } = {}) {
  const data = await cfFetch(`/accounts/pages/projects?page=${page}&per_page=${perPage}`);
  return data.result;
}

export async function getPagesProject(accountId, projectName) {
  const data = await cfFetch(`/accounts/${accountId}/pages/projects/${projectName}`);
  return data.result;
}

export async function createPagesProject(accountId, { name, productionBranch = "main" }) {
  const data = await cfFetch(`/accounts/${accountId}/pages/projects`, {
    method: "POST",
    body: JSON.stringify({ name, production_branch: productionBranch }),
  });
  return data.result;
}

export async function deletePagesProject(accountId, projectName) {
  await cfFetch(`/accounts/${accountId}/pages/projects/${projectName}`, { method: "DELETE" });
}

// ── R2 Storage ────────────────────────────────────────────────────────────────

export async function listR2Buckets({ page = 1, perPage = 50 } = {}) {
  const data = await cfFetch(`/accounts/r2/buckets?page=${page}&per_page=${perPage}`);
  return data.result;
}

export async function createR2Bucket(accountId, { name }) {
  const data = await cfFetch(`/accounts/${accountId}/r2/buckets`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.result;
}

export async function deleteR2Bucket(accountId, name) {
  await cfFetch(`/accounts/${accountId}/r2/buckets/${name}`, { method: "DELETE" });
}

// ── KV Storage ────────────────────────────────────────────────────────────────

export async function listKVNamespaces({ page = 1, perPage = 50 } = {}) {
  const data = await cfFetch(`/accounts/storage/kv/namespaces?page=${page}&per_page=${perPage}`);
  return data.result;
}

export async function createKVNamespace(accountId, { title }) {
  const data = await cfFetch(`/accounts/${accountId}/storage/kv/namespaces`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return data.result;
}

export async function deleteKVNamespace(accountId, namespaceId) {
  await cfFetch(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`, { method: "DELETE" });
}

export async function listKVKeys(accountId, namespaceId, { cursor, prefix, limit = 100 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (prefix) params.set("prefix", prefix);
  const data = await cfFetch(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?${params}`);
  return data;
}

export async function putKVKey(accountId, namespaceId, key, value, { expiration, expirationTtl } = {}) {
  const body = { value };
  if (expiration) body.expiration = expiration;
  if (expirationTtl) body.expiration_ttl = expirationTtl;
  await cfFetch(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: value,
  });
}

export async function getKVKey(accountId, namespaceId, key) {
  const token = await getCloudflareToken();
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("KV key not found");
  return res.text();
}

export async function deleteKVKey(accountId, namespaceId, key) {
  await cfFetch(`/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

// ── D1 Database ───────────────────────────────────────────────────────────────

export async function listD1Databases({ page = 1, perPage = 50 } = {}) {
  const data = await cfFetch(`/accounts/d1/database?page=${page}&per_page=${perPage}`);
  return data.result;
}

export async function createD1Database(accountId, { name }) {
  const data = await cfFetch(`/accounts/${accountId}/d1/database`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.result;
}

export async function deleteD1Database(accountId, databaseId) {
  await cfFetch(`/accounts/${accountId}/d1/database/${databaseId}`, { method: "DELETE" });
}

export async function queryD1(accountId, databaseId, sql, params = []) {
  const data = await cfFetch(`/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({ sql, params }),
  });
  return data.result;
}

// ── Connection Management ─────────────────────────────────────────────────────

export async function disconnectCloudflare() {
  await cfKv.remove("user");
}

export async function isConnected() {
  const token = await getCloudflareToken();
  return Boolean(token);
}
