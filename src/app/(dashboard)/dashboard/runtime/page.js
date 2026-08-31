"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import { translate } from "@/i18n/runtime";
import { useNotificationStore } from "@/store/notificationStore";

// Runtime page — REAL feature flags backed by dashboard settings, plus the
// non-sensitive process environment. Toggles persist via PATCH /api/settings.
const FLAGS = [
  { id: "rtkEnabled", name: "Token Saver (RTK)", description: "Compress tool results before dispatch" },
  { id: "headroomEnabled", name: "Headroom proxy", description: "External compression proxy" },
  { id: "cavemanEnabled", name: "Caveman", description: "System-prompt compressor" },
  { id: "ponytailEnabled", name: "Ponytail", description: "Prompt condenser" },
  { id: "semanticCacheEnabled", name: "Semantic Cache", description: "Serve similar prompts from cache" },
  { id: "pxpipeEnabled", name: "PXPIPE", description: "Image/payload pipeline" },
];

const SAFE_ENV_KEYS = ["NODE_ENV", "PORT", "DATA_DIR", "REQUIRE_API_KEY", "NR_DB_DRIVER", "ENABLE_REQUEST_LOGS", "OBSERVABILITY_ENABLED"];

export default function RuntimePage() {
  const notify = useNotificationStore();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const d = await res.json();
      setSettings(d || {});
    } catch {
      notify.error(translate("Failed to load runtime settings"));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFlag = async (id, enabled) => {
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [id]: enabled }),
      });
      if (!res.ok) throw new Error(translate("Request failed"));
      setSettings((s) => ({ ...s, [id]: enabled }));
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5"><div className="h-24" /></Card>
        <Card className="p-5"><div className="h-24" /></Card>
      </div>
    );
  }

  const envRows = SAFE_ENV_KEYS.map((k) => ({ key: k, value: process.env[k] ?? "", sensitive: false }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">{translate("Runtime")}</h1>
        <p className="text-sm text-text-muted mt-1">{translate("Live feature flags and runtime environment")}</p>
      </div>

      <Card title={translate("Feature flags")} subtitle={translate("Persisted in settings — changes apply to new requests")}>
        <div className="space-y-2">
          {FLAGS.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-main">{translate(f.name)}</p>
                <p className="text-xs text-text-muted truncate">{f.description}</p>
              </div>
              <Toggle checked={!!settings?.[f.id]} onChange={(v) => toggleFlag(f.id, v)} disabled={busy} />
            </div>
          ))}
        </div>
      </Card>

      <Card title={translate("Environment")} subtitle={translate("Non-sensitive environment variables")}>
        <div className="divide-y divide-border-subtle">
          {envRows.map((e) => (
            <div key={e.key} className="flex items-center justify-between py-2 gap-4">
              <code className="text-xs font-mono text-text-muted" dir="ltr">{e.key}</code>
              <span className="text-sm text-text-main truncate" dir="ltr">{String(e.value || "—")}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
