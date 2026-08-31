"use client";
import { translate } from "@/i18n/runtime";
import { useState, useEffect, useMemo } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";
import Badge from "@/shared/components/Badge";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

const COLORS = ["#4f8cff", "#34d399", "#f59e0b", "#f472b6", "#a78bfa"];

function MetricCard({ icon, label, value, sub, accent = "text-primary" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-[20px] ${accent}`}>{icon}</span>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-text-main">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </Card>
  );
}

function TrendChart({ data, dataKey, color, title }) {
  if (!data || data.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-3)" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-surface-3)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CachePage() {
  const [stats, setStats] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ semanticCache: { enabled: false } });
  const [trends, setTrends] = useState([]);
  const [tab, setTab] = useState("overview");
  const [deleteSearch, setDeleteSearch] = useState("");
  const [pruning, setPruning] = useState(false);
  const [qdrantConfig, setQdrantConfig] = useState({ host: "localhost", port: "6333", apiKey: "" });
  const [qdrantTesting, setQdrantTesting] = useState(false);
  const [qdrantTestResult, setQdrantTestResult] = useState(null);

  const loadData = async () => {
    try {
      const [sRes, eRes, stRes, tRes] = await Promise.all([
        fetch("/api/semantic-cache"),
        fetch("/api/semantic-cache?action=list"),
        fetch("/api/settings"),
        fetch("/api/semantic-cache?action=trends").catch(() => ({ ok: false })),
      ]);
      setStats(await sRes.json());
      setEntries((await eRes.json()).entries || []);
      setSettings(await stRes.json());
      if (tRes.ok) setTrends((await tRes.json()).trends || []);
    } catch {
      // fail-open
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sRes, eRes, stRes] = await Promise.all([
          fetch("/api/semantic-cache"),
          fetch("/api/semantic-cache?action=list"),
          fetch("/api/settings"),
        ]);
        if (cancelled) return;
        setStats(await sRes.json());
        setEntries((await eRes.json()).entries || []);
        setSettings(await stRes.json());
      } catch {
        // fail-open
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async (val) => {
    const next = { ...(settings.semanticCache || {}), enabled: val };
    setSettings({ ...settings, semanticCache: next });
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ semanticCache: next }),
      });
    } catch {
      // fail-open
    }
  };

  const handlePrune = async () => {
    setPruning(true);
    try {
      await fetch("/api/semantic-cache?action=prune", { method: "POST" });
      await loadData();
    } catch {
      // fail-open
    } finally {
      setPruning(false);
    }
  };

  const handleDelete = async (key) => {
    try {
      await fetch("/api/semantic-cache?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      setEntries(entries.filter((e) => e.key !== key));
    } catch {
      // fail-open
    }
  };

  const handleClear = async () => {
    if (!confirm("Delete ALL cache entries?")) return;
    try {
      await fetch("/api/semantic-cache?action=clear", { method: "POST" });
      setEntries([]);
    } catch {
      // fail-open
    }
  };

  const handleQdrantTest = async () => {
    setQdrantTesting(true);
    setQdrantTestResult(null);
    try {
      const res = await fetch("/api/qdrant/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(qdrantConfig),
      });
      setQdrantTestResult(res.ok ? "ok" : "fail");
    } catch {
      setQdrantTestResult("fail");
    } finally {
      setQdrantTesting(false);
    }
  };

  const handleQdrantSave = async () => {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qdrant: qdrantConfig }),
      });
    } catch {}
  };

  const filteredEntries = useMemo(() => {
    if (!deleteSearch) return entries;
    const q = deleteSearch.toLowerCase();
    return entries.filter(
      (e) =>
        (e.query || "").toLowerCase().includes(q) ||
        (e.model || "").toLowerCase().includes(q) ||
        (e.key || "").toLowerCase().includes(q)
    );
  }, [entries, deleteSearch]);

  const hitRate = stats?.totalRequests ? ((stats.hits / stats.totalRequests) * 100).toFixed(1) : "0.0";
  const tokenSavings = stats?.tokenSavings || 0;
  const costSavings = stats?.costSavings || 0;

  if (loading) return <div className="p-6"><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Semantic Cache")}</h1>
          <p className="text-sm text-text-muted mt-1">{translate("Cache similar responses to reduce API calls and costs")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            checked={settings.semanticCache?.enabled ?? false}
            onChange={handleToggle}
          />
          <span className="text-sm font-medium text-text-main">
            {settings.semanticCache?.enabled ? translate("Enabled") : translate("Disabled")}
          </span>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon="speed" label="Hit Rate" value={`${hitRate}%`} sub={`${stats?.hits || 0} / ${stats?.totalRequests || 0} requests`} accent="text-success" />
        <MetricCard icon="savings" label="Tokens Saved" value={tokenSavings.toLocaleString()} sub={`~$${costSavings.toFixed(4)} saved`} accent="text-primary" />
        <MetricCard icon="database" label="Cache Entries" value={entries.length.toLocaleString()} sub={`Max: ${settings.semanticCache?.maxEntries || 10000}`} />
        <MetricCard icon="timer" label="Avg Latency" value={stats?.avgLatency ? `${stats.avgLatency}ms` : "—"} sub="Cache hit response time" accent="text-warning" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-3">
        {["overview", "entries", "trends", "idempotency", "reasoning", "memory", "qdrant", "pipeline"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            {t === "idempotency" ? "Idempotency" : t === "reasoning" ? "Reasoning" : t === "memory" ? "Memory" : t === "qdrant" ? "Qdrant" : t === "pipeline" ? "Pipeline" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {/* Model Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-main mb-4">{translate("Model Distribution")}</h3>
              {entries.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(
                        entries.reduce((acc, e) => {
                          acc[e.model || "unknown"] = (acc[e.model || "unknown"] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.entries(entries.reduce((acc, e) => { acc[e.model || "unknown"] = (acc[e.model || "unknown"] || 0) + 1; return acc; }, {})).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-text-muted text-center py-8">{translate("No data yet")}</p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-text-main mb-4">{translate("Cache by Provider")}</h3>
              {entries.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={Object.entries(
                      entries.reduce((acc, e) => {
                        const p = (e.model || "unknown").split("/")[0] || "unknown";
                        acc[p] = (acc[p] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([name, value]) => ({ name, value }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-3)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-surface-3)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" fill="#4f8cff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-text-muted text-center py-8">No data yet</p>
              )}
            </Card>
          </div>

          {/* Recent Entries */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-main mb-4">{translate("Recent Entries")}</h3>
            {entries.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">{translate("No cache entries yet")}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {entries.slice(0, 20).map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-3/50 text-sm">
                    <Badge variant="success" size="sm">{entry.model || "?"}</Badge>
                    <span className="text-text-main truncate flex-1">{entry.query || entry.key?.slice(0, 60)}</span>
                    <span className="text-text-muted text-xs">{entry.hits || 0} hits</span>
                    <span className="text-text-muted text-xs">{new Date(entry.createdAt || 0).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "entries" && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder={translate("Search entries by query, model, or key...")}
              value={deleteSearch}
              onChange={(e) => setDeleteSearch(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={handlePrune} disabled={pruning}>
              {pruning ? translate("Pruning...") : translate("Prune Stale")}
            </Button>
            <Button size="sm" variant="danger" onClick={handleClear}>{translate("Clear All")}</Button>
          </div>

          {filteredEntries.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-12">
              {deleteSearch ? translate("No matching entries") : translate("No cache entries")}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredEntries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-3/30 hover:bg-surface-3/60 transition-colors text-sm"
                >
                  <Badge variant="success" size="sm">{entry.model || "?"}</Badge>
                  <span className="text-text-main truncate flex-1">{entry.query || "—"}</span>
                  <span className="text-text-muted text-xs whitespace-nowrap">{entry.hits || 0} hits</span>
                  <span className="text-text-muted text-xs whitespace-nowrap">{new Date(entry.createdAt || 0).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleDelete(entry.key)}
                    className="text-text-muted hover:text-danger transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "trends" && (
        <div className="space-y-6">
          {trends.length > 0 ? (
            <>
              <Card className="p-5">
                <TrendChart data={trends} dataKey="hits" color="#34d399" title={translate("Cache Hits Over Time")} />
              </Card>
              <Card className="p-5">
                <TrendChart data={trends} dataKey="tokensSaved" color="#4f8cff" title={translate("Tokens Saved Over Time")} />
              </Card>
              <Card className="p-5">
                <TrendChart data={trends} dataKey="costSaved" color="#f59e0b" title={translate("Cost Saved Over Time")} />
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">analytics</span>
              <p className="text-sm text-text-muted">No trend data yet. Cache hits will appear here as requests are processed.</p>
            </Card>
          )}
        </div>
      )}

      {tab === "idempotency" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-main">{translate("Idempotency Layer")}</h3>
                <p className="text-xs text-text-muted">Prevent duplicate requests from creating duplicate cache entries</p>
              </div>
              <Badge variant={settings.semanticCache?.idempotency?.enabled ? "success" : "default"} size="sm">
                {settings.semanticCache?.idempotency?.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Duplicate Requests Blocked</p>
                <p className="text-xl font-bold text-text-main mt-1">{stats?.idempotency?.blocked || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Dedup Window</p>
                <p className="text-xl font-bold text-text-main mt-1">{settings.semanticCache?.idempotency?.windowSec || 30}s</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "reasoning" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-main">{translate("Reasoning Cache")}</h3>
                <p className="text-xs text-text-muted">Cache thinking/reasoning steps for complex queries</p>
              </div>
              <Badge variant={settings.semanticCache?.reasoning?.enabled ? "success" : "default"} size="sm">
                {settings.semanticCache?.reasoning?.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Reasoning Entries</p>
                <p className="text-xl font-bold text-text-main mt-1">{stats?.reasoning?.entries || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Hit Rate</p>
                <p className="text-xl font-bold text-success mt-1">{stats?.reasoning?.hitRate || "0.0"}%</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Tokens Saved</p>
                <p className="text-xl font-bold text-primary mt-1">{(stats?.reasoning?.tokensSaved || 0).toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "memory" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-main">{translate("Memory Cards")}</h3>
                <p className="text-xs text-text-muted">Persistent memory for conversation context</p>
              </div>
              <Badge variant={settings.semanticCache?.memory?.enabled ? "success" : "default"} size="sm">
                {settings.semanticCache?.memory?.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Memory Entries</p>
                <p className="text-xl font-bold text-text-main mt-1">{stats?.memory?.entries || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Total Size</p>
                <p className="text-xl font-bold text-text-main mt-1">{stats?.memory?.size || "0 KB"}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "qdrant" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-main">{translate("Qdrant Vector Store")}</h3>
                <p className="text-xs text-text-muted">Vector database for semantic memory and embeddings</p>
              </div>
              <Badge variant={settings.qdrant?.connected ? "success" : "default"} size="sm">
                {settings.qdrant?.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>

            <div className="p-4 rounded-xl bg-surface-3/30 space-y-3">
              <p className="text-xs font-semibold text-text-muted">{translate("Connection Config")}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-text-muted mb-1 block">Host</label>
                  <input
                    type="text"
                    value={qdrantConfig.host}
                    onChange={(e) => setQdrantConfig({ ...qdrantConfig, host: e.target.value })}
                    placeholder="localhost"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted mb-1 block">Port</label>
                  <input
                    type="number"
                    value={qdrantConfig.port}
                    onChange={(e) => setQdrantConfig({ ...qdrantConfig, port: e.target.value })}
                    placeholder="6333"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted mb-1 block">API Key</label>
                  <input
                    type="password"
                    value={qdrantConfig.apiKey}
                    onChange={(e) => setQdrantConfig({ ...qdrantConfig, apiKey: e.target.value })}
                    placeholder={translate("Optional")}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleQdrantTest}
                  disabled={qdrantTesting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">{qdrantTesting ? "hourglass_top" : "wifi_find"}</span>
                  {qdrantTesting ? translate("Testing...") : translate("Test Connection")}
                </button>
                {qdrantTestResult && (
                  <Badge variant={qdrantTestResult === "ok" ? "success" : "danger"} size="sm">
                    {qdrantTestResult === "ok" ? translate("Connected") : translate("Failed")}
                  </Badge>
                )}
                <button
                  onClick={handleQdrantSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-main hover:bg-surface-3 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  Save
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">{translate("Collections")}</p>
                <p className="text-xl font-bold text-text-main mt-1">{stats?.qdrant?.collections || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Vectors</p>
                <p className="text-xl font-bold text-text-main mt-1">{(stats?.qdrant?.vectors || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Memory Size</p>
                <p className="text-xl font-bold text-text-main mt-1">{stats?.qdrant?.sizeMB || "0 MB"}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-muted">Collections</p>
              {["memory", "embeddings", "cache"].map((col) => (
                <div key={col} className="flex items-center justify-between py-2 border-b border-surface-3 last:border-0">
                  <span className="text-sm text-text-main font-mono">{col}</span>
                  <div className="flex items-center gap-2">
                    <Badge size="sm">active</Badge>
                    <span className="text-xs text-text-muted">{stats?.qdrant?.collections?.[col] || 0} vectors</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "pipeline" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">{translate("Cache Pipeline Visualizer")}</h3>
            <p className="text-xs text-text-muted">Request flow through the caching pipeline</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {[
                { label: "Client Request", icon: "input", status: "active" },
                { label: "Hash Check", icon: "fingerprint", status: "completed" },
                { label: "Semantic Match", icon: "psychology", status: "completed" },
                { label: "Embedding Lookup", icon: "data_array", status: "completed" },
                { label: "Cache Hit/Miss", icon: "cached", status: "completed" },
                { label: "Response", icon: "output", status: "active" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <div className={`p-3 rounded-xl border-2 min-w-[120px] text-center ${step.status === "active" ? "border-success bg-success/5" : "border-primary bg-primary/5"}`}>
                    <span className="material-symbols-outlined text-[20px] text-primary">{step.icon}</span>
                    <p className="text-xs font-medium text-text-main mt-1">{step.label}</p>
                  </div>
                  {i < 5 && <span className="material-symbols-outlined text-[16px] text-text-muted">arrow_forward</span>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Avg Pipeline Latency</p>
                <p className="text-xl font-bold text-primary mt-1">{stats?.pipeline?.latency || "2ms"}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-3/50">
                <p className="text-xs text-text-muted">Throughput</p>
                <p className="text-xl font-bold text-success mt-1">{stats?.pipeline?.throughput || "1.2K"} req/s</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
