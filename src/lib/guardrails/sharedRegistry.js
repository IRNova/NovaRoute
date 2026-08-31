// Shared guardrails runtime used BOTH by the /api/guardrails admin surface and
// the live gateway hook (chatCore). One registry instance per process so
// toggles in the dashboard affect real traffic.
//
// Safety: the gateway path is gated behind an explicit master flag
// (kv "guardrails"."gatewayEnabled", default OFF). The library's defaults are
// aggressive (prompt-injection = enabled + block), so we never enforce on
// traffic until the operator turns enforcement on.
import { createDefaultRegistry } from "./registry.js";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("guardrails");
const FLAG_TTL_MS = 15_000;

let registryPromise = null;
let cachedGatewayEnabled = null;
let flagReadAt = 0;

export function getSharedRegistry() {
  if (!registryPromise) {
    registryPromise = (async () => {
      const reg = createDefaultRegistry();
      try {
        const saved = await kv.get("states", {});
        if (saved && typeof saved === "object") {
          for (const g of reg.guardrails) {
            if (typeof saved[g.name] === "boolean") g.enabled = saved[g.name];
          }
        }
      } catch {}
      return reg;
    })();
  }
  return registryPromise;
}

export async function persistGuardrailStates(reg) {
  try {
    const states = {};
    for (const g of reg.guardrails) states[g.name] = !!g.enabled;
    await kv.set("states", states);
  } catch {}
}

export async function isGatewayEnforcementEnabled() {
  const now = Date.now();
  if (cachedGatewayEnabled !== null && now - flagReadAt < FLAG_TTL_MS) return cachedGatewayEnabled;
  try {
    cachedGatewayEnabled = (await kv.get("gatewayEnabled", false)) === true;
    flagReadAt = now;
  } catch {
    if (cachedGatewayEnabled === null) cachedGatewayEnabled = false;
  }
  return cachedGatewayEnabled;
}

export async function setGatewayEnforcement(enabled) {
  const value = enabled === true;
  await kv.set("gatewayEnabled", value);
  cachedGatewayEnabled = value;
  flagReadAt = Date.now();
  return value;
}

/**
 * Run enabled guardrails against outgoing chat messages.
 * Fail-open contract (mirrors rtk/ hooks): any error or nothing-to-do → null.
 * Returns null when enforcement is off, messages are absent, or nothing was
 * detected/modified; otherwise the registry result { blocked, modifiedMessages,
 * detections, summary }.
 */
export async function runGatewayGuardrails(messages, context = {}) {
  try {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    if (!(await isGatewayEnforcementEnabled())) return null;
    const reg = await getSharedRegistry();
    if (!reg.guardrails.some((g) => g.enabled)) return null;
    const result = await reg.run({ messages, provider: context.provider, model: context.model });
    if (!result || (!result.blocked && !result.modifiedMessages)) return null;
    return result;
  } catch {
    return null;
  }
}
