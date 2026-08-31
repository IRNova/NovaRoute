"use client";

import { useState, useEffect, useCallback } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";
import { translate } from "@/i18n/runtime";
import { useNotificationStore } from "@/store/notificationStore";

export default function GuardrailsPage() {
  const notify = useNotificationStore();
  const [guardrails, setGuardrails] = useState([]);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scanText, setScanText] = useState("");
  const [scanResult, setScanResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/guardrails");
      const d = await res.json();
      setGuardrails(Array.isArray(d?.guardrails) ? d.guardrails : []);
      setGatewayEnabled(d?.gatewayEnabled === true);
    } catch {
      notify.error(translate("Failed to load guardrails"));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (name, enabled) => {
    setBusy(true);
    try {
      const res = await fetch("/api/guardrails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", guardrailName: name, enabled }),
      });
      if (!res.ok) throw new Error(translate("Toggle failed"));
      await load();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const scan = async (action, label) => {
    if (!scanText.trim()) return notify.error(translate("Enter some text to scan"));
    setBusy(true);
    try {
      const res = await fetch("/api/guardrails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: scanText }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || translate("Scan failed"));
      setScanResult({ kind: label, ...d });
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const enabledCount = guardrails.filter((g) => g.enabled).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Guardrails")}</h1>
          <p className="text-sm text-text-muted mt-1">
            {translate("Content safety filters")} — {enabledCount}/{guardrails.length} {translate("enabled")}
          </p>
        </div>
      </div>

      <Card title={translate("Enforce on gateway traffic")} subtitle={translate("When enabled, requests through /v1 are scanned — masked or blocked by these rules. Off by default.")}>
        <Toggle
          checked={gatewayEnabled}
          onChange={async (v) => {
            setBusy(true);
            try {
              const res = await fetch("/api/guardrails", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "set-gateway-enabled", enabled: v }),
              });
              if (!res.ok) throw new Error(translate("Request failed"));
              setGatewayEnabled(v);
              notify.success(v ? translate("Gateway enforcement enabled") : translate("Gateway enforcement disabled"));
            } catch (err) {
              notify.error(err.message);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
        />
      </Card>

      <Card title={translate("Registered Guardrails")} subtitle={translate("Applied to messages flowing through the gateway")}>
        {guardrails.length === 0 ? (
          <p className="text-sm text-text-muted">{translate("No guardrails registered.")}</p>
        ) : (
          <div className="space-y-2">
            {guardrails.map((g) => (
              <div key={g.name} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-main">{g.name}</p>
                  {g.description ? <p className="text-xs text-text-muted truncate">{String(g.description)}</p> : null}
                </div>
                <Toggle checked={!!g.enabled} onChange={(v) => toggle(g.name, v)} disabled={busy} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={translate("Scanner Playground")} subtitle={translate("Test PII and credential detection on sample text")}>
        <textarea
          value={scanText}
          onChange={(e) => setScanText(e.target.value)}
          rows={4}
          placeholder={translate("Paste a message to scan for PII or credentials...")}
          className="w-full p-3 rounded-xl bg-surface-3/50 border border-border-subtle text-sm text-text-main resize-y focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex gap-2 mt-3">
          <Button variant="primary" disabled={busy} onClick={() => scan("scan-pii", translate("PII"))}>
            {translate("Scan PII")}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => scan("scan-credentials", translate("Credentials"))}>
            {translate("Scan Credentials")}
          </Button>
        </div>
        {scanResult ? (
          <div className="mt-4">
            <p className="text-sm text-text-main mb-2">
              {scanResult.kind}: <strong>{scanResult.total ?? scanResult.detections?.length ?? 0}</strong> {translate("detection(s)")}
            </p>
            <pre className="max-h-56 overflow-auto p-3 rounded-xl bg-surface-3/50 border border-border-subtle text-xs font-mono text-text-muted whitespace-pre-wrap" dir="ltr">
              {JSON.stringify(scanResult.detections ?? [], null, 2)}
            </pre>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
