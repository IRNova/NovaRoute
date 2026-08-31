import { makeKv } from "../helpers/kvStore.js";

const SCOPE = "modelTestResults";
const kv = makeKv(SCOPE);

function key(providerAlias, modelId) {
  return `${providerAlias}:${modelId}`;
}

export async function getModelTestResult(providerAlias, modelId) {
  return kv.get(key(providerAlias, modelId), null);
}

export async function getModelTestResultsByProvider(providerAlias) {
  const all = await kv.getAll();
  const out = {};
  const prefix = `${providerAlias}:`;
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(prefix)) {
      const modelId = k.slice(prefix.length);
      out[modelId] = v;
    }
  }
  return out;
}

export async function setModelTestResult(providerAlias, modelId, result) {
  const record = {
    status: result.ok ? "ok" : "error",
    error: result.error || null,
    latencyMs: result.latencyMs || null,
    statusCode: result.status || null,
    testedAt: new Date().toISOString(),
  };
  await kv.set(key(providerAlias, modelId), record);
  return record;
}

export async function deleteModelTestResult(providerAlias, modelId) {
  await kv.remove(key(providerAlias, modelId));
}

export async function clearModelTestResultsByProvider(providerAlias) {
  const all = await kv.getAll();
  const prefix = `${providerAlias}:`;
  for (const k of Object.keys(all)) {
    if (k.startsWith(prefix)) await kv.remove(k);
  }
}
