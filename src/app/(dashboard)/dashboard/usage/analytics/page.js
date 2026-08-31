"use client";

import { translate } from "@/i18n/runtime";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardSkeleton, SegmentedControl, Badge } from "@/shared/components";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const PERIODS = [
  { value: "today", label: translate("Today") },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

const PIE_COLORS = [
  "#4f8cff", "#34d399", "#f59e0b", "#f472b6", "#a78bfa",
  "#22d3ee", "#fb7185", "#84cc16", "#fbbf24", "#60a5fa",
];

const fmtMoney = (v) =>
  v >= 1 ? `$${v.toFixed(2)}` : v > 0 ? `$${v.toFixed(4)}` : "$0.00";

const fmtCompact = (v) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v);

const TASK_LABELS = {
  general: "General",
  coding: "Coding",
  creative: "Creative",
  analysis: "Analysis",
  agentic: "Agentic",
  tools: "Tools",
  debug: "Debug",
};

function KpiCard({ label, value, sub, icon, accent = "text-primary" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-[20px] ${accent}`} aria-hidden="true">{icon}</span>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-text-main">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-text-muted">{sub}</p> : null}
    </Card>
  );
}

function OverviewTab({ stats, chart }) {
  const providerPie = useMemo(() => {
    if (!stats?.byProvider) return [];
    return Object.entries(stats.byProvider)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 8)
      .map(([name, p]) => ({ name, value: Math.max(0.0001, p.cost || 0), label: name }));
  }, [stats]);

  const topModels = useMemo(() => {
    if (!stats?.byModel) return [];
    return Object.values(stats.byModel)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }, [stats]);

  const successRate = stats?.totalRequests
    ? Math.round(((stats.successRequests || 0) / stats.totalRequests) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Total Requests" value={fmtCompact(stats?.totalRequests || 0)} icon="ads_click" />
        <KpiCard
          label="Total Tokens"
          value={fmtCompact((stats?.totalPromptTokens || 0) + (stats?.totalCompletionTokens || 0))}
          sub={`${fmtCompact(stats?.totalPromptTokens || 0)} in / ${fmtCompact(stats?.totalCompletionTokens || 0)} out`}
          icon="data_object"
          accent="text-success"
        />
        <KpiCard
          label="Total Cost"
          value={fmtMoney(stats?.totalCost || 0)}
          icon="payments"
          accent="text-warning"
        />
        <KpiCard
          label="Success Rate"
          value={`${successRate}%`}
          icon="check_circle"
          accent={successRate >= 90 ? "text-success" : "text-warning"}
        />
      </div>

      <Card title="Tokens & Cost Over Time" className="p-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart || []}>
              <defs>
                <linearGradient id="tokFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f8cff" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#4f8cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--mu)" }} />
              <YAxis
                yAxisId="tokens"
                tick={{ fontSize: 11, fill: "var(--mu)" }}
                tickFormatter={fmtCompact}
                width={52}
              />
              <YAxis
                yAxisId="cost"
                orientation="right"
                tick={{ fontSize: 11, fill: "var(--mu)" }}
                tickFormatter={(v) => (v >= 0.01 ? `$${v}` : v)}
                width={52}
              />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 12 }}
                formatter={(value, name) => (name === "cost" ? [fmtMoney(Number(value)), "Cost"] : [fmtCompact(Number(value)), "Tokens"])}
              />
              <Area yAxisId="tokens" type="monotone" dataKey="tokens" stroke="#4f8cff" strokeWidth={2} fill="url(#tokFill)" />
              <Area yAxisId="cost" type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Cost by Provider" className="p-4">
          {providerPie.length ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={providerPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {providerPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 12 }}
                      formatter={(value) => fmtMoney(Number(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5">
                {providerPie.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="min-w-0 flex-1 truncate text-text-main">{p.name}</span>
                    <span className="font-semibold text-text-main">{fmtMoney(p.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-52 items-center justify-center text-sm text-text-muted">No provider cost data yet.</div>
          )}
        </Card>

        <Card title="Top Models by Cost" className="p-4">
          {topModels.length ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topModels.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--mu)" }} tickFormatter={(v) => `$${v}`} />
                  <YAxis
                    type="category"
                    dataKey="rawModel"
                    tick={{ fontSize: 10, fill: "var(--mu)" }}
                    width={140}
                    tickFormatter={(v) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 12 }}
                    formatter={(value) => fmtMoney(Number(value))}
                  />
                  <Bar dataKey="cost" fill="#34d399" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-52 items-center justify-center text-sm text-text-muted">No model cost data yet.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function RoutingHealthTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/routing-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const heatmap = useMemo(() => {
    if (!data) return [];
    const hours = {};
    for (const t of data.timeline || []) {
      const key = t.hour || "";
      if (!hours[key]) hours[key] = { hour: key, requests: 0, failures: 0, avgLatencyMs: 0 };
      hours[key].requests += t.requests || 0;
      hours[key].failures += t.failures || 0;
      if (t.requests) hours[key].avgLatencyMs += (t.avgLatencyMs || 0) * t.requests;
    }
    for (const h of Object.values(hours)) {
      if (h.requests) h.avgLatencyMs = Math.round(h.avgLatencyMs / h.requests);
    }
    return Object.values(hours).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [data]);

  if (loading) return <CardSkeleton />;

  const summary = data?.summary || [];
  const totalSamples = summary.reduce((s, r) => s + (r.samples || 0), 0);
  const totalSuccess = summary.reduce((s, r) => s + (r.success || 0), 0);
  const weightedLatency = totalSamples
    ? summary.reduce((s, r) => s + (r.avgLatencyMs || 0) * (r.samples || 0), 0) / totalSamples
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Model-Provider Samples" value={fmtCompact(totalSamples)} icon="monitoring" />
        <KpiCard label="Overall Success" value={totalSamples ? `${Math.round((totalSuccess / totalSamples) * 100)}%` : "—"} icon="check_circle" accent="text-success" />
        <KpiCard label="Avg Latency" value={weightedLatency ? `${Math.round(weightedLatency)}ms` : "—"} icon="timer" />
        <KpiCard label="Tracked Routes" value={String(summary.length)} icon="alt_route" accent="text-warning" />
      </div>

      {heatmap.length ? (
        <Card title="Traffic — Last 24h" className="p-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={heatmap}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--mu)" }} tickFormatter={(v) => v?.slice(11, 16) || ""} />
                <YAxis tick={{ fontSize: 11, fill: "var(--mu)" }} tickFormatter={fmtCompact} width={44} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 12 }}
                  formatter={(value, name) => [fmtCompact(Number(value)), name === "failures" ? "Failures" : "Requests"]}
                />
                <Bar dataKey="requests" fill="#4f8cff" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="failures" fill="#fb7185" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}

      <Card title="Model Health (combo & auto-routing telemetry)" className="p-4">
        {summary.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Task</th>
                  <th className="py-2 pr-4 text-right">Samples</th>
                  <th className="py-2 pr-4 text-right">Success</th>
                  <th className="py-2 pr-4 text-right">Avg Latency</th>
                  <th className="py-2 text-right">Avg Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {summary.slice(0, 100).map((r, i) => {
                  const sr = r.successRate || 0;
                  return (
                    <tr key={i} className="hover:bg-bg-subtle transition-colors">
                      <td className="py-2 pr-4 font-mono text-xs text-text-main">{r.model}</td>
                      <td className="py-2 pr-4"><span className="text-text-muted">{r.provider}</span></td>
                      <td className="py-2 pr-4"><span className="text-xs text-text-muted">{TASK_LABELS[r.taskType] || r.taskType}</span></td>
                      <td className="py-2 pr-4 text-right text-text-main">{r.samples}</td>
                      <td className="py-2 pr-4 text-right">
                        <span className={`text-xs font-semibold ${sr >= 0.9 ? "text-success" : sr >= 0.6 ? "text-warning" : "text-error"}`}>
                          {Math.round(sr * 100)}%
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right text-text-muted">{r.avgLatencyMs ? `${Math.round(r.avgLatencyMs)}ms` : "—"}</td>
                      <td className="py-2 text-right text-text-muted">{r.avgCost ? fmtMoney(r.avgCost) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-text-muted">
            No routing telemetry yet — stats accumulate as requests flow through combos and auto-routing.
          </div>
        )}
      </Card>
    </div>
  );
}

export default function UsageAnalyticsPage() {
  const [period, setPeriod] = useState("7d");
  const [tab, setTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      return ["overview", "costs", "providers", "routing", "utilization", "cache", "trace"].includes(t) ? t : "overview";
    } catch {
      return "overview";
    }
  });
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab !== "overview" && tab !== "costs" && tab !== "providers") return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/usage/stats?period=${period}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/usage/chart?period=${period}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([s, c]) => {
        if (cancelled) return;
        setStats(s);
        setChart(c);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, tab]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="rounded-2xl border border-border bg-surface p-2 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            options={[
              { value: "overview", label: translate("Overview") },
              { value: "costs", label: translate("Costs") },
              { value: "providers", label: translate("Providers") },
              { value: "routing", label: translate("Routing Health") },
              { value: "utilization", label: translate("Utilization") },
              { value: "cache", label: translate("Cache Health") },
              { value: "trace", label: translate("Route Trace") },
            ]}
            value={tab}
            onChange={setTab}
            className="w-full sm:w-auto"
          />
          {(tab === "overview" || tab === "costs" || tab === "providers") && (
            <SegmentedControl
              options={PERIODS}
              value={period}
              onChange={setPeriod}
              size="sm"
              className="w-full sm:w-auto"
            />
          )}
        </div>
      </div>

      {tab === "overview" &&
        (loading ? <CardSkeleton /> : (
          <div className="flex flex-col gap-4">
            <OverviewTab stats={stats} chart={chart} />
            <LatencyCard period={period} />
          </div>
        ))}
      {tab === "costs" &&
        (loading ? <CardSkeleton /> : <CostsTab stats={stats} chart={chart} />)}
      {tab === "providers" &&
        (loading ? <CardSkeleton /> : <ProvidersTab stats={stats} />)}
      {tab === "routing" && <RoutingHealthTab />}
      {tab === "utilization" && <UtilizationTab />}
      {tab === "cache" && <CacheHealthTab />}
      {tab === "trace" && <RouteTraceTab />}
    </div>
  );
}

function CostsTab({ stats, chart }) {
  const totalCost = Number(stats?.totalCost) || 0;
  const totalRequests = Number(stats?.totalRequests) || 0;
  const avgCost = totalRequests > 0 ? totalCost / totalRequests : 0;
  const byProvider = Object.entries(stats?.byProvider || {})
    .map(([name, e]) => ({ name, cost: Number(e?.cost) || 0, requests: Number(e?.requests) || 0 }))
    .filter((p) => p.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">{translate("Total Cost")}</p>
          <p className="text-2xl font-bold text-text-main mt-1" dir="ltr">${totalCost.toFixed(4)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">{translate("Avg cost per request")}</p>
          <p className="text-2xl font-bold text-text-main mt-1" dir="ltr">${avgCost.toFixed(5)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide">{translate("Requests")}</p>
          <p className="text-2xl font-bold text-text-main mt-1" dir="ltr">{totalRequests.toLocaleString()}</p>
        </Card>
      </div>

      <Card title={translate("Daily cost")} subtitle={translate("Spend over the selected period")}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart || []}>
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary, #7c3aed)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary, #7c3aed)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="cost" stroke="#f59e0b" fill="url(#costGrad)" strokeWidth={2} name={translate("Cost")} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={translate("Cost by provider")} subtitle={translate("Top spenders in the selected period")}>
        {byProvider.length === 0 ? (
          <p className="text-sm text-text-muted">{translate("No usage data yet.")}</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProvider.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cost" fill="#f59e0b" radius={[0, 6, 6, 0]} name={translate("Cost")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

function ProvidersTab({ stats }) {
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConnections(Array.isArray(d?.connections) ? d.connections : []))
      .catch(() => {});
  }, []);

  const byProvider = Object.entries(stats?.byProvider || {})
    .map(([key, e]) => ({
      name: e?.provider || key.split(" (")[0],
      requests: Number(e?.requests) || 0,
      promptTokens: Number(e?.promptTokens) || 0,
      completionTokens: Number(e?.completionTokens) || 0,
      cost: Number(e?.cost) || 0,
      lastUsed: e?.lastUsed || null,
    }))
    .sort((a, b) => b.requests - a.requests);

  const statusFor = (name) => {
    const conn = connections.find((c) => c.provider === name && c.isActive !== false);
    if (!conn) return { label: translate("no connection"), variant: "default" };
    const s = String(conn.testStatus || "unknown").toLowerCase();
    if (s === "active" || s === "success") return { label: translate("healthy"), variant: "success" };
    if (s === "error" || s === "unavailable") return { label: translate("failing"), variant: "error" };
    if (s === "expired") return { label: translate("quota exhausted"), variant: "warning" };
    return { label: s, variant: "default" };
  };

  if (byProvider.length === 0) {
    return (
      <Card padding="md">
        <p className="text-sm text-text-muted">{translate("No usage data yet.")}</p>
      </Card>
    );
  }

  return (
    <Card title={translate("Provider performance")} subtitle={`${byProvider.length} ${translate("provider(s)")}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted border-b border-border-subtle">
              <th className="py-2 pr-4 font-medium">{translate("Provider")}</th>
              <th className="py-2 pr-4 font-medium">{translate("Requests")}</th>
              <th className="py-2 pr-4 font-medium">{translate("Tokens")}</th>
              <th className="py-2 pr-4 font-medium">{translate("Cost")}</th>
              <th className="py-2 pr-4 font-medium">{translate("Last Used")}</th>
              <th className="py-2 font-medium">{translate("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {byProvider.map((p) => {
              const st = statusFor(p.name);
              return (
                <tr key={p.name} className="border-b border-border-subtle/50">
                  <td className="py-2 pr-4 font-medium text-text-main">{p.name}</td>
                  <td className="py-2 pr-4 text-text-muted" dir="ltr">{p.requests.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-text-muted" dir="ltr">{(p.promptTokens + p.completionTokens).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-text-muted" dir="ltr">${p.cost.toFixed(4)}</td>
                  <td className="py-2 pr-4 text-text-muted whitespace-nowrap">
                    {p.lastUsed ? new Date(p.lastUsed).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2"><Badge variant={st.variant}>{st.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UtilizationTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage/stats?period=7d")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CardSkeleton />;

  const accounts = Object.entries(data?.byAccount || {})
    .sort((a, b) => b[1].requests - a[1].requests)
    .map(([key, a]) => ({
      account: a.accountName || key,
      provider: a.provider || "",
      requests: a.requests || 0,
      tokens: (a.promptTokens || 0) + (a.completionTokens || 0),
      cost: a.cost || 0,
    }));

  const activeTotal = (data?.activeRequests || []).reduce((s, r) => s + (r.count || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Accounts Used" value={fmtCompact(accounts.length)} icon="groups" />
        <KpiCard label="Total Requests" value={fmtCompact(data?.totalRequests || 0)} icon="ads_click" />
        <KpiCard label="Active Right Now" value={fmtCompact(activeTotal)} icon="pulse" accent="text-success" />
        <KpiCard label="Pending Accounts" value={fmtCompact(Object.keys(data?.pending?.byAccount || {}).length)} icon="hourglass" accent="text-warning" />
      </div>

      <Card title="Account Utilization — Requests & Tokens" className="p-4">
        {accounts.length ? (
          <div className="space-y-4">
            {accounts.slice(0, 25).map((a) => {
              const share = data?.totalRequests ? Math.min(100, (a.requests / data.totalRequests) * 100) : 0;
              return (
                <div key={`${a.account}-${a.provider}`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate font-medium text-text-main">
                      {a.account}
                      {a.provider ? <span className="ms-2 text-[10px] uppercase text-text-muted">{a.provider}</span> : null}
                    </span>
                    <span className="text-text-muted">{a.requests.toLocaleString()} req · {fmtCompact(a.tokens)} tok · {fmtMoney(a.cost)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-text-muted">No account usage recorded yet.</div>
        )}
      </Card>
    </div>
  );
}

function CacheHealthTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/semantic-cache")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CardSkeleton />;

  const total = data?.total || 0;
  const totalHits = data?.totalHits || 0;
  const hitRate = total ? (totalHits / (total + totalHits)) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Cached Entries" value={fmtCompact(total)} icon="database" />
        <KpiCard label="Total Hits" value={fmtCompact(totalHits)} icon="bolt" accent="text-warning" />
        <KpiCard label="Hit Rate" value={`${hitRate.toFixed(1)}%`} icon="target" accent="text-success" />
        <KpiCard label="Embedding Providers" value={String((data?.embeddingProviders || []).length)} icon="texture" />
      </div>

      <Card title="Embedding Providers" className="p-4">
        {data?.embeddingProviders?.length ? (
          <div className="flex flex-wrap gap-2">
            {(data.embeddingProviders || []).map((p) => (
              <span key={p} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-text-main">
                {p}
              </span>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-text-muted">No embedding providers configured.</div>
        )}
        <div className="mt-4 text-center">
          <Link href="/dashboard/cache" className="text-sm font-medium text-primary hover:underline">
            Manage Semantic Cache →
          </Link>
        </div>
      </Card>
    </div>
  );
}

function RouteTraceTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage/stats?period=24h")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRows(d?.recentRequests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CardSkeleton />;

  return (
    <Card title="Recent Requests — Routing Trace" className="p-4">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Model / Provider</th>
                <th className="py-2 pr-4 text-right">Prompt</th>
                <th className="py-2 pr-4 text-right">Completion</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-bg-subtle transition-colors">
                  <td className="py-2 pr-4 whitespace-nowrap text-xs text-text-muted">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="font-mono text-xs text-text-main">{r.model}</span>
                    {r.provider ? <span className="ms-2 text-[10px] uppercase text-text-muted">{r.provider}</span> : null}
                  </td>
                  <td className="py-2 pr-4 text-right text-text-muted">{fmtCompact(r.promptTokens || 0)}</td>
                  <td className="py-2 pr-4 text-right text-text-muted">{fmtCompact(r.completionTokens || 0)}</td>
                  <td className="py-2 text-right">
                    <span className={`text-xs font-semibold ${r.status === "ok" ? "text-success" : "text-error"}`}>
                      {r.status || "ok"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-text-muted">No recent requests found.</div>
      )}
    </Card>
  );
}

// ─── Latency percentiles (from requestDetails ledger) ─────────────────────
function LatencyCard({ period }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/usage/latency?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, [period]);

  if (!data || !data.total || data.total.samples === 0) return null;

  const rows = [
    ["P50", data.total.p50],
    ["P95", data.total.p95],
    ["P99", data.total.p99],
  ];

  return (
    <Card title={translate("Latency percentiles")} subtitle={`${data.total.samples} ${translate("requests")} · TTFT P50 ${data.ttft?.p50 ?? "—"} ms`}>
      <div className="grid grid-cols-3 gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="p-3 rounded-xl bg-surface-3/50 border border-border-subtle text-center">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="text-lg font-bold text-text-main" dir="ltr">{value ?? "—"}<span className="text-xs font-normal"> ms</span></p>
          </div>
        ))}
      </div>
    </Card>
  );
}
