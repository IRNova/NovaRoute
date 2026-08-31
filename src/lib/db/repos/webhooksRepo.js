import { makeKv } from "../helpers/kvStore.js";

const kv = makeKv("webhooks");
const ENTRIES_KEY = "entries";

export async function getWebhooks() {
  const entries = await kv.get(ENTRIES_KEY, []);
  return entries
    .filter((w) => w && typeof w === "object")
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function getWebhookById(id) {
  const entries = await getWebhooks();
  return entries.find((w) => w.id === id) || null;
}

export async function createWebhook(data) {
  const entries = await getWebhooks();
  const now = new Date().toISOString();
  const webhook = {
    id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: data.url || "",
    events: Array.isArray(data.events) ? data.events : [],
    secret: typeof data.secret === "string" ? data.secret : "",
    active: data.active !== false,
    method: data.method || "POST",
    createdAt: now,
    updatedAt: now,
    deliveryCount: 0,
    failureCount: 0,
    lastStatus: null,
    lastDelivery: null,
    retryCount: 0,
  };
  entries.push(webhook);
  await kv.set(ENTRIES_KEY, entries);
  return webhook;
}

export async function updateWebhook(id, data) {
  const entries = await getWebhooks();
  const index = entries.findIndex((w) => w.id === id);
  if (index === -1) return null;

  const existing = entries[index];
  const updated = {
    ...existing,
    url: data.url !== undefined ? data.url : existing.url,
    events: data.events !== undefined ? (Array.isArray(data.events) ? data.events : existing.events) : existing.events,
    secret: data.secret !== undefined ? data.secret : existing.secret,
    active: data.active !== undefined ? data.active === true : existing.active,
    method: data.method !== undefined ? data.method : existing.method,
    updatedAt: new Date().toISOString(),
  };
  entries[index] = updated;
  await kv.set(ENTRIES_KEY, entries);
  return updated;
}

export async function deleteWebhook(id) {
  const entries = await getWebhooks();
  const index = entries.findIndex((w) => w.id === id);
  if (index === -1) return false;
  entries.splice(index, 1);
  await kv.set(ENTRIES_KEY, entries);
  return true;
}

export async function recordWebhookDelivery(id, result) {
  const entries = await getWebhooks();
  const index = entries.findIndex((w) => w.id === id);
  if (index === -1) return null;

  const existing = entries[index];
  const success = result && result.ok;
  const updated = {
    ...existing,
    deliveryCount: (existing.deliveryCount || 0) + 1,
    failureCount: (existing.failureCount || 0) + (success ? 0 : 1),
    lastStatus: success ? "success" : "error",
    lastDelivery: new Date().toISOString(),
    retryCount: success ? 0 : (existing.retryCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  entries[index] = updated;
  await kv.set(ENTRIES_KEY, entries);
  return updated;
}
