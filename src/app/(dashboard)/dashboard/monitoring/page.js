"use client";

import { useState, useEffect, useCallback } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import { translate } from "@/i18n/runtime";
import { useNotificationStore } from "@/store/notificationStore";

function severityBadge(sev) {
  const s = String(sev || "info").toLowerCase();
  if (s.includes("crit") || s.includes("error")) return <Badge variant="error">{s}</Badge>;
  if (s.includes("warn")) return <Badge variant="warning">{s}</Badge>;
  return <Badge variant="info">{s}</Badge>;
}

export default function MonitoringPage() {
  const notify = useNotificationStore();
  const [status, setStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("monitoring");

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        fetch("/api/monitoring?action=status").then((r) => r.json()),
        fetch("/api/monitoring?action=alerts").then((r) => r.json()),
      ]);
      setStatus(s);
      setAlerts(Array.isArray(a?.alerts) ? a.alerts : []);
    } catch {
      notify.error(translate("Failed to load monitoring data"));
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
      const res = await fetch("/api/monitoring", {
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

  const health = status?.health;
  const healthChecks = Array.isArray(health)
    ? health
    : health && typeof health === "object"
      ? Object.entries(health).map(([name, value]) => ({ name, ...(typeof value === "object" ? value : { status: value }) }))
      : [];
  const metrics = status?.metrics && typeof status.metrics === "object" ? status.metrics : {};
  const metricEntries = Object.entries(metrics).slice(0, 12);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Monitoring")}</h1>
          <p className="text-sm text-text-muted mt-1">{translate("Health checks, metrics and alerts")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => post({ action: "evaluate-alerts" }, translate("Alert rules evaluated"))}>
            {translate("Evaluate alerts")}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => post({ action: "reset-metrics" }, translate("Metrics reset"))}>
            {translate("Reset metrics")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("monitoring")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${tab === "monitoring" ? "bg-primary/10 text-primary border-primary/30" : "bg-surface-3/50 text-text-muted border-border-subtle"}`}
        >
          {translate("Monitoring")}
        </button>
        <button
          type="button"
          onClick={() => setTab("system")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${tab === "system" ? "bg-primary/10 text-primary border-primary/30" : "bg-surface-3/50 text-text-muted border-border-subtle"}`}
        >
          {translate("System")}
        </button>
      </div>

      {tab === "system" ? (
        <SystemSection />
      ) : (
        <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {healthChecks.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-text-muted">{translate("No health checks registered.")}</p>
          </Card>
        ) : (
          healthChecks.slice(0, 3).map((check) => {
            const ok = /ok|healthy|pass/i.test(String(check.status ?? check.healthy ?? ""));
            return (
              <Card padding="md" key={check.name}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`p-2 rounded-[10px] ${ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"} material-symbols-outlined`}>
                      monitor_heart
                    </span>
                    <div>
                      <p className="text-xs text-text-muted uppercase tracking-wide">{check.name}</p>
                      <p className="text-lg font-bold text-text-main">{String(check.status ?? check.healthy ?? translate("unknown"))}</p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card title={translate("Metrics")} subtitle={translate("Live counters and gauges from the collector")}>
        {metricEntries.length === 0 ? (
          <p className="text-sm text-text-muted">{translate("No metrics recorded yet — counters appear as traffic flows.")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {metricEntries.map(([name, value]) => (
              <div key={name} className="p-4 rounded-xl bg-surface-3/50 border border-border-subtle">
                <p className="text-xs text-text-muted uppercase tracking-wide truncate">{name}</p>
                <p className="text-xl font-bold text-text-main mt-1">
                  {typeof value === "number" ? value.toLocaleString() : typeof value === "object" ? JSON.stringify(value).slice(0, 40) : String(value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={translate("Alerts")} subtitle={`${alerts.length} ${translate("alert(s)")}`}>
        {alerts.length === 0 ? (
          <p className="text-sm text-text-muted">{translate("No active alerts.")}</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id || a.ruleId} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
                <div className="min-w-0 flex items-center gap-3">
                  {severityBadge(a.severity)}
                  <p className="text-sm text-text-main truncate">{a.message || a.name}</p>
                </div>
                <Button variant="secondary" disabled={busy} onClick={() => post({ action: "clear-alert", alertId: a.id || a.alertId }, translate("Alert cleared"))}>
                  {translate("Clear")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
        </>
      )}
    </div>
  );
}

function SystemSection() {
  const [sys, setSys] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/system")
      .then((r) => r.json())
      .then(setSys)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (!sys) return <p className="text-sm text-text-muted">{translate("Failed to load monitoring data")}</p>;

  const rows = [
    [translate("Version"), sys.version],
    ["Node", sys.nodeVersion],
    [translate("Platform"), `${sys.platform}/${sys.arch}`],
    [translate("Uptime"), `${Math.floor((sys.uptimeSeconds || 0) / 3600)}h ${Math.floor(((sys.uptimeSeconds || 0) % 3600) / 60)}m`],
    ["PID", String(sys.process?.pid ?? "—")],
    [translate("User"), sys.process?.user || "—"],
    ["CPU", `${sys.cpu?.model || "—"} (${sys.cpu?.cores || "?"} cores, ${sys.cpu?.usagePercent ?? 0}%)`],
    [
      translate("Memory"),
      `RSS ${sys.memory?.rssMB}MB · heap ${sys.memory?.heapUsedMB}/${sys.memory?.heapTotalMB}MB`,
    ],
    [
      "DB",
      `${sys.db?.driver || "—"} · ${sys.db?.sizeMB}MB · ${(sys.db?.tables || []).length} ${translate("tables")}`,
    ],
  ];

  return (
    <Card title={translate("System information")} subtitle={translate("Live process and runtime details")}>
      <div className="divide-y divide-border-subtle">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-2.5">
            <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
            <span className="text-sm text-text-main text-left break-all" dir="ltr">{String(value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
