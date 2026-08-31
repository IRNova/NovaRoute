// Shared compliance audit trail. Both the /api/compliance surface and live
// gateway hooks (auto-ban, guardrails) append to the SAME persisted store, so
// the dashboard shows one merged trail. Fire-and-forget: never throw.
import { AuditLogger } from "./index.js";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const AUDIT_PERSIST_LIMIT = 500;

const kv = makeKv("compliance");

export const auditTrail = new AuditLogger({
  sink: {
    async write(entry) {
      const list = (await kv.get("auditEntries", [])) || [];
      list.push(entry);
      await kv.set("auditEntries", list.slice(-AUDIT_PERSIST_LIMIT));
    },
  },
});

let restored = false;
export async function restoreAuditTrail() {
  if (restored) return;
  restored = true;
  try {
    const list = await kv.get("auditEntries", []);
    if (Array.isArray(list) && list.length && auditTrail.entries.length === 0) {
      auditTrail.entries.push(...list.slice(-AUDIT_PERSIST_LIMIT));
    }
  } catch {}
}

export async function logAudit(event) {
  try {
    await restoreAuditTrail();
    await auditTrail.log({
      userId: "system",
      action: "event",
      severity: "info",
      ...event,
    });
  } catch {}
}
