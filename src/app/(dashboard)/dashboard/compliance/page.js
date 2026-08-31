"use client";

import { useState, useEffect, useCallback } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import Input from "@/shared/components/Input";
import { translate } from "@/i18n/runtime";
import { useNotificationStore } from "@/store/notificationStore";

function severityVariant(sev) {
  const s = String(sev || "info").toLowerCase();
  if (s.includes("crit") || s.includes("high") || s.includes("error")) return "error";
  if (s.includes("warn")) return "warning";
  return "info";
}

export default function CompliancePage() {
  const notify = useNotificationStore();
  const [entries, setEntries] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [filter, setFilter] = useState("");
  const [newPolicy, setNewPolicy] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([
        fetch("/api/compliance?action=audit&limit=100").then((r) => r.json()),
        fetch("/api/compliance?action=policies").then((r) => r.json()),
      ]);
      setEntries(Array.isArray(a?.entries) ? a.entries : []);
      setPolicies(Array.isArray(p?.policies) ? p.policies : []);
    } catch {
      notify.error(translate("Failed to load compliance data"));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const addPolicy = async () => {
    if (!newPolicy.trim()) return;
    setBusy(true);
    try {
      let policy;
      try {
        policy = JSON.parse(newPolicy);
      } catch {
        policy = { name: newPolicy.trim() };
      }
      const res = await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-policy", policy }),
      });
      if (!res.ok) throw new Error(translate("Failed to add policy"));
      setNewPolicy("");
      notify.success(translate("Policy added"));
      await load();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removePolicy = async (policyId) => {
    setBusy(true);
    try {
      await fetch("/api/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-policy", policyId }),
      });
      notify.success(translate("Policy removed"));
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

  const filtered = filter
    ? entries.filter((e) => JSON.stringify(e).toLowerCase().includes(filter.toLowerCase()))
    : entries;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Compliance")}</h1>
          <p className="text-sm text-text-muted mt-1">{translate("Audit trail and access policies")}</p>
        </div>
        <Button variant="secondary" onClick={load} disabled={busy}>
          {translate("Refresh")}
        </Button>
      </div>

      <Card title={translate("Policies")} subtitle={`${policies.length} ${translate("policy(ies)")}`}>
        {policies.length > 0 && (
          <div className="space-y-2 mb-4">
            {policies.map((p) => {
              const id = p.id || p.name;
              return (
                <div key={id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">{p.name || id}</p>
                    {p.description ? <p className="text-xs text-text-muted truncate">{String(p.description)}</p> : null}
                  </div>
                  <Button variant="secondary" disabled={busy} onClick={() => removePolicy(id)}>
                    {translate("Remove")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newPolicy}
            onChange={(e) => setNewPolicy(e.target.value)}
            placeholder={translate('Policy name or JSON')}
            onKeyDown={(e) => e.key === "Enter" && addPolicy()}
          />
          <Button variant="primary" disabled={busy} onClick={addPolicy}>
            {translate("Add")}
          </Button>
        </div>
      </Card>

      <Card
        title={translate("Audit Log")}
        subtitle={`${filtered.length} / ${entries.length} ${translate("entries")} — ${translate("in-memory since last restart")}`}
        action={
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={translate("Filter...")} className="max-w-[200px]" />
        }
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-text-muted">{translate("No audit entries recorded yet.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-muted border-b border-border-subtle">
                  <th className="py-2 pr-4 font-medium">{translate("Time")}</th>
                  <th className="py-2 pr-4 font-medium">{translate("User")}</th>
                  <th className="py-2 pr-4 font-medium">{translate("Action")}</th>
                  <th className="py-2 pr-4 font-medium">{translate("Provider")}</th>
                  <th className="py-2 font-medium">{translate("Severity")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((e, i) => (
                  <tr key={e.id || i} className="border-b border-border-subtle/50">
                    <td className="py-2 pr-4 text-text-muted whitespace-nowrap">
                      {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : "—"}
                    </td>
                    <td className="py-2 pr-4 text-text-main truncate max-w-[140px]">{e.userId || e.user || translate("system")}</td>
                    <td className="py-2 pr-4 text-text-main truncate max-w-[200px]">{e.action || e.eventAction || "—"}</td>
                    <td className="py-2 pr-4 text-text-muted truncate max-w-[140px]">{e.provider || "—"}</td>
                    <td className="py-2">
                      <Badge variant={severityVariant(e.severity)}>{String(e.severity || "info")}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
