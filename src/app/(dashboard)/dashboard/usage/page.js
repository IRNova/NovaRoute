"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UsageStats, RequestLogger, CardSkeleton, SegmentedControl, Card, Button, Input, Badge, Toggle, Select } from "@/shared/components";
import RequestDetailsTab from "./components/RequestDetailsTab";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { translate } from "@/i18n/runtime";

const PERIODS = [
  { value: "today", label: translate("Today") },
  { value: "24h", label: translate("24h") },
  { value: "7d", label: translate("7D") },
  { value: "30d", label: translate("30D") },
  { value: "60d", label: translate("60D") },
];

const TABS = [
  { value: "overview", label: translate("Overview"), icon: "dashboard" },
  { value: "logs", label: translate("Logs"), icon: "receipt_long" },
  { value: "details", label: translate("Request Details"), icon: "info" },
  { value: "budget", label: translate("Budget"), icon: "account_balance_wallet" },
  { value: "evals", label: translate("Evals"), icon: "science" },
  { value: "sessions", label: translate("Sessions"), icon: "groups" },
  { value: "rate-limits", label: translate("Rate Limits"), icon: "speed" },
];

export default function UsagePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <UsageContent />
    </Suspense>
  );
}

function UsageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [period, setPeriod] = useState("today");

  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl && TABS.map((t) => t.value).includes(tabFromUrl) ? tabFromUrl : "overview";

  const handleTabChange = (value) => {
    if (value === activeTab) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`/dashboard/usage?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-border bg-surface p-2 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            options={TABS.map((t) => ({ value: t.value, label: t.label }))}
            value={activeTab}
            onChange={handleTabChange}
          />
          <SegmentedControl
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
            value={period}
            onChange={(v) => setPeriod(v)}
          />
        </div>
      </div>

      {activeTab === "overview" && <UsageStats period={period} />}
      {activeTab === "logs" && <RequestLogger period={period} />}
      {activeTab === "details" && <RequestDetailsTab />}
      {activeTab === "budget" && <BudgetTab period={period} />}
      {activeTab === "evals" && <EvalsTab />}
      {activeTab === "sessions" && <SessionsTab />}
      {activeTab === "rate-limits" && <RateLimitsTab />}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Budget Tab — Per-key daily/weekly/monthly limits + templates
   ────────────────────────────────────────────────────────────── */
function BudgetTab({ period }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", keyId: "", limit: 100, period: "daily", type: "tokens" });

  useEffect(() => {
    fetch("/api/usage/budgets")
      .then((r) => r.json())
      .then((d) => { setBudgets(d.budgets || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    try {
      await fetch("/api/usage/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm({ name: "", keyId: "", limit: 100, period: "daily", type: "tokens" });
      const res = await fetch("/api/usage/budgets");
      setBudgets((await res.json()).budgets || []);
    } catch { /* fail-open */ }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this budget?")) return;
    try {
      await fetch(`/api/usage/budgets?id=${id}`, { method: "DELETE" });
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    } catch { /* fail-open */ }
  };

  if (loading) return <CardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-main">{translate("Budget Limits")}</h2>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? translate("Cancel") : "+ " + translate("New Budget")}
        </Button>
      </div>

      {showCreate && (
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input placeholder={translate("Budget name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select
              options={[
                { value: "daily", label: translate("Daily") },
                { value: "weekly", label: translate("Weekly") },
                { value: "monthly", label: translate("Monthly") },
              ]}
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
            <Select
              options={[
                { value: "tokens", label: translate("Tokens") },
                { value: "cost", label: translate("Cost ($)") },
                { value: "requests", label: translate("Requests") },
              ]}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            />
            <Input type="number" placeholder={translate("Limit")} value={form.limit} onChange={(e) => setForm({ ...form, limit: parseFloat(e.target.value) || 0 })} />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={!form.name}>{translate("Create Budget")}</Button>
        </Card>
      )}

      {budgets.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">account_balance_wallet</span>
          <p className="text-sm text-text-muted">{translate("No budgets set. Create one to limit spending per API key.")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const used = b.used || 0;
            const pct = b.limit > 0 ? Math.min(100, (used / b.limit) * 100) : 0;
            const over = b.limit > 0 && used > b.limit;
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-main">{b.name}</span>
                    <Badge variant={over ? "danger" : "success"} size="sm">{b.period}</Badge>
                    <Badge size="sm">{b.type}</Badge>
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="text-text-muted hover:text-danger">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${over ? "bg-danger" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-text-muted whitespace-nowrap">
                    {used.toLocaleString()} / {b.limit.toLocaleString()}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Evals Tab — Evaluation suites, test runs, results
   ────────────────────────────────────────────────────────────── */
function EvalsTab() {
  const [suites, setSuites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/usage/evals")
      .then((r) => r.json())
      .then((d) => { setSuites(d.suites || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleRun = async (suiteId) => {
    setRunning(true);
    try {
      await fetch(`/api/usage/evals/${suiteId}/run`, { method: "POST" });
      const res = await fetch("/api/usage/evals");
      setSuites((await res.json()).suites || []);
    } catch { /* fail-open */ } finally { setRunning(false); }
  };

  if (loading) return <CardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-main">{translate("Evaluation Suites")}</h2>
        <p className="text-sm text-text-muted">{translate("Test model quality with structured eval cases")}</p>
      </div>

      {suites.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">science</span>
          <p className="text-sm text-text-muted">{translate("No eval suites yet. Create one to measure model quality.")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {suites.map((s) => (
            <Card key={s.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedSuite(selectedSuite?.id === s.id ? null : s)}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-text-main">{s.name}</span>
                  <p className="text-xs text-text-muted mt-0.5">{s.description || `${s.cases?.length || 0} cases`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.lastResult === "pass" ? "success" : s.lastResult === "fail" ? "danger" : "warning"} size="sm">
                    {s.lastResult || "not run"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); handleRun(s.id); }}
                    disabled={running}
                  >
                    {running ? "Running..." : "Run"}
                  </Button>
                </div>
              </div>
              {selectedSuite?.id === s.id && s.cases && (
                <div className="mt-4 space-y-2 border-t border-surface-3 pt-4">
                  {s.cases.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <Badge variant={c.passed ? "success" : "danger"} size="sm">{c.passed ? "PASS" : "FAIL"}</Badge>
                      <span className="text-text-main truncate flex-1">{c.input || c.prompt || "—"}</span>
                      <span className="text-text-muted text-xs">{c.latencyMs ? `${c.latencyMs}ms` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sessions Tab — Active session tracking
   ────────────────────────────────────────────────────────────── */
function SessionsTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch("/api/usage/sessions")
        .then((r) => r.json())
        .then((d) => { setSessions(d.sessions || []); setLoading(false); })
        .catch(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <CardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-main">{translate("Active Sessions")}</h2>
        <Badge size="sm">{sessions.length} active</Badge>
      </div>

      {sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">groups</span>
          <p className="text-sm text-text-muted">{translate("No active sessions. Sessions appear when clients connect.")}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <div>
                    <span className="font-medium text-text-main text-sm">{s.client || "Unknown Client"}</span>
                    <p className="text-xs text-text-muted">{s.model || "—"}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-text-muted">
                  <p>{s.requests || 0} requests</p>
                  <p>{s.tokens || 0} tokens</p>
                  <p>{s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : ""}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Rate Limits Tab — Per-model/provider rate limit status
   ────────────────────────────────────────────────────────────── */
function RateLimitsTab() {
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage/rate-limits")
      .then((r) => r.json())
      .then((d) => { setLimits(d.limits || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <CardSkeleton />;

  const COLORS = ["#4f8cff", "#34d399", "#f59e0b", "#f472b6", "#a78bfa"];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-text-main">{translate("Rate Limit Status")}</h2>

      {limits.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">speed</span>
          <p className="text-sm text-text-muted">{translate("No per-key rate limits are set. Add one on an API key (Dashboard → API Keys → limits).")}</p>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-main mb-4">{translate("Requests in the last minute, per key")}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={limits.map((l) => ({ name: l.name || l.provider || l.model, requests: l.current || 0, limit: l.rpm || 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-3)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                <Tooltip contentStyle={{ background: "var(--color-surface-2)", border: "1px solid var(--color-surface-3)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="requests" radius={[4, 4, 0, 0]}>
                  {limits.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="space-y-2">
            {limits.map((l, i) => {
              const pct = l.rpm > 0 ? Math.min(100, ((l.current || 0) / l.rpm) * 100) : 0;
              const nearLimit = pct > 80;
              return (
                <Card key={i} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={nearLimit ? "danger" : "success"} size="sm">{l.name || l.provider}</Badge>
                      <span className="text-sm text-text-main">{l.rpm ? `${l.rpm} rpm` : translate("no limit")}{l.active ? ` · ${l.active} in flight` : ""}</span>
                    </div>
                    <span className="text-sm text-text-muted">{l.current || 0}{l.rpm ? ` / ${l.rpm}` : ""} {translate("requests this minute")}</span>
                  </div>
                  <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${nearLimit ? "bg-danger" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
