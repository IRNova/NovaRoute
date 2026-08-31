"use client";

import { useState, useEffect, useCallback } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import { translate } from "@/i18n/runtime";
import { useNotificationStore } from "@/store/notificationStore";

export default function SecurityPage() {
  const notify = useNotificationStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockIp, setBlockIp] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/security?action=status");
      const d = await res.json();
      setData(d);
    } catch {
      notify.error(translate("Failed to load security status"));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body, successMsg) => {
    setBusy(true);
    try {
      const res = await fetch("/api/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || translate("Request failed"));
      if (successMsg) notify.success(successMsg);
      await load();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const blocked = Array.isArray(data?.blockedIPs) ? data.blockedIPs : [];
  const keys = Array.isArray(data?.apiKeys) ? data.apiKeys : [];
  const rl = data?.rateLimiter || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Security Center")}</h1>
          <p className="text-sm text-text-muted mt-1">{translate("Rate limiting, IP blocking and API key validation")}</p>
        </div>
        <Button variant="secondary" onClick={() => post({ action: "cleanup" }, translate("Cleanup done"))} disabled={busy}>
          {translate("Cleanup expired")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-[10px] bg-danger/10 material-symbols-outlined text-danger">block</span>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide">{translate("Blocked IPs")}</p>
              <p className="text-2xl font-bold text-text-main">{blocked.length}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-[10px] bg-primary/10 material-symbols-outlined text-primary">key</span>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide">{translate("Registered Keys")}</p>
              <p className="text-2xl font-bold text-text-main">{keys.length}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-[10px] bg-success/10 material-symbols-outlined text-success">speed</span>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide">{translate("Rate Limit Window")}</p>
              <p className="text-2xl font-bold text-text-main">
                {Math.round((rl.windowMs || 0) / 1000)}s / {rl.maxRequests ?? "—"} {translate("requests")}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title={translate("Blocked IPs")} subtitle={translate("Block or unblock client IP addresses")}>
        <div className="flex gap-2 mb-4">
          <Input
            value={blockIp}
            onChange={(e) => setBlockIp(e.target.value)}
            placeholder={translate("e.g. 203.0.113.5")}
            className="max-w-xs"
          />
          <Button
            variant="primary"
            disabled={busy || !blockIp.trim()}
            onClick={async () => {
              await post({ action: "block-ip", ip: blockIp.trim() }, translate("IP blocked"));
              setBlockIp("");
            }}
          >
            {translate("Block")}
          </Button>
        </div>
        {blocked.length === 0 ? (
          <p className="text-sm text-text-muted">{translate("No IPs are currently blocked.")}</p>
        ) : (
          <div className="space-y-2">
            {(typeof blocked === "object" && !Array.isArray(blocked)
              ? Object.entries(blocked).map(([ip, info]) => ({ ip, ...info }))
              : blocked.map((b) => (typeof b === "string" ? { ip: b } : b))
            ).map((entry) => (
              <div key={entry.ip} className="flex items-center justify-between p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
                <span className="font-mono text-sm text-text-main" dir="ltr">{entry.ip}</span>
                <Button variant="secondary" disabled={busy} onClick={() => post({ action: "unblock-ip", ip: entry.ip }, translate("IP unblocked"))}>
                  {translate("Unblock")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={translate("Registered API Keys")} subtitle={translate("Validation registry managed by the security module")}>
        {keys.length === 0 ? (
          <p className="text-sm text-text-muted">{translate("No registered keys yet.")}</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.key || k.keyId || k.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-main truncate">{k.userId || k.keyId || k.key}</p>
                  <p className="text-xs text-text-muted truncate">{Array.isArray(k.permissions) ? k.permissions.join(", ") : ""}</p>
                </div>
                <Button variant="secondary" disabled={busy} onClick={() => post({ action: "revoke-key", key: k.key }, translate("Key revoked"))}>
                  {translate("Revoke")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
