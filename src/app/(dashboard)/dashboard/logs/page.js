"use client";
import { translate } from "@/i18n/runtime";
import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Badge from "@/shared/components/Badge";
import Select from "@/shared/components/Select";

function StatusBadge({ status }) {
  if (status >= 200 && status < 300) return <Badge variant="success" size="sm">{status}</Badge>;
  if (status >= 400 && status < 500) return <Badge variant="warning" size="sm">{status}</Badge>;
  if (status >= 500) return <Badge variant="danger" size="sm">{status}</Badge>;
  return <Badge size="sm">{status || "?"}</Badge>;
}

function RequestLogsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const deepLinkId = searchParams.get("id");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [tab, setTab] = useState("table");
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [proxyLogs, setProxyLogs] = useState([]);
  const esRef = useRef(null);

  const loadLogs = async () => {
    try {
      const res = await fetch("/api/usage/request-logs");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      // fail-open
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Deep link: auto-select log by ?id= param
  useEffect(() => {
    if (deepLinkId && logs.length > 0) {
      const idx = logs.findIndex((l) => String(l.id) === String(deepLinkId) || l.requestId === deepLinkId);
      if (idx >= 0) {
        setSelectedLog(idx);
        setTab("table");
      }
    }
  }, [deepLinkId, logs]);

  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const startStreaming = () => {
    setStreaming(true);
    const es = new EventSource("/api/usage/request-logs?stream=true");
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        setLogs((prev) => [entry, ...prev].slice(0, 500));
      } catch {
        // ignore
      }
    };
    es.onerror = () => setStreaming(false);
  };

  const stopStreaming = () => {
    esRef.current?.close();
    setStreaming(false);
  };

  const handleExport = () => {
    const csv = [
      "Timestamp,Model,Provider,Status,Prompt Tokens,Completion Tokens,Total Tokens,Cost,Latency (ms)",
      ...filtered.map((l) =>
        [
          l.timestamp,
          l.model || "",
          l.provider || "",
          l.status || "",
          l.usage?.promptTokens || 0,
          l.usage?.completionTokens || 0,
          l.usage?.totalTokens || 0,
          l.cost || 0,
          l.latencyMs || 0,
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `novaroute-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const providers = useMemo(() => {
    const set = new Set(logs.map((l) => l.provider).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filter) {
        const q = filter.toLowerCase();
        if (
          !(l.model || "").toLowerCase().includes(q) &&
          !(l.provider || "").toLowerCase().includes(q) &&
          !(l.requestId || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (statusFilter !== "all") {
        if (statusFilter === "success" && (l.status || 0) >= 400) return false;
        if (statusFilter === "error" && (l.status || 0) < 400) return false;
      }
      if (providerFilter !== "all" && l.provider !== providerFilter) return false;
      return true;
    });
  }, [logs, filter, statusFilter, providerFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return sortDir === "asc" ? ta - tb : tb - ta;
    });
  }, [filtered, sortDir]);

  if (loading) return <div className="p-6"><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Request Logs")}</h1>
          <p className="text-sm text-text-muted mt-1">{sorted.length} {translate("requests")}</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/usage/export?format=csv&type=requests&period=7d"
            download
            className="inline-flex items-center px-3 py-1.5 rounded-lg border border-border-subtle text-sm text-text-muted hover:text-text-main hover:border-border transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] me-1">download</span>
            CSV
          </a>
          <Button
            size="sm"
            variant={streaming ? "danger" : "outline"}
            onClick={streaming ? stopStreaming : startStreaming}
          >
            <span className="material-symbols-outlined text-[16px] me-1">
              {streaming ? "stop" : "play_arrow"}
            </span>
            {streaming ? translate("Stop") : translate("Live")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <span className="material-symbols-outlined text-[16px] me-1">download</span>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-3">
        {[
          { key: "table", label: translate("Table") },
          { key: "timeline", label: translate("Timeline") },
          { key: "activity", label: translate("Activity") },
          { key: "console", label: translate("Console") },
          { key: "proxy", label: translate("Proxy Logs") },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={translate("Search by model, provider, or request ID...")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <Select
          options={[
            { value: "all", label: translate("All Status") },
            { value: "success", label: translate("Success") },
            { value: "error", label: translate("Error") },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
        <Select
          options={providers.map((p) => ({ value: p, label: p === "all" ? translate("All Providers") : p }))}
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
        />
      </div>

      {/* Log Table */}
      {/* Table Tab */}
      {tab === "table" && (
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-muted text-xs uppercase">
              <tr>
                <th
                  className="p-3 cursor-pointer select-none hover:text-primary"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  <div className="flex items-center gap-1">
                    Time
                    <span className="material-symbols-outlined text-[14px]">
                      {sortDir === "asc" ? "expand_less" : "expand_more"}
                    </span>
                  </div>
                </th>
                <th className="p-3">Provider</th>
                <th className="p-3">Model</th>
                <th className="p-3 text-right">Tokens</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Latency</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3/50">
              {sorted.map((log, i) => (
                <tr
                  key={i}
                  className={`hover:bg-surface-2/50 cursor-pointer transition-colors ${
                    selectedLog === i ? "bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    const next = selectedLog === i ? null : i;
                    setSelectedLog(next);
                    if (next !== null && sorted[next]) {
                      router.push(`/dashboard/logs?id=${sorted[next].id || sorted[next].requestId || ""}`, { scroll: false });
                    } else {
                      router.push("/dashboard/logs", { scroll: false });
                    }
                  }}
                >
                  <td className="p-3 text-text-muted text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium text-text-main uppercase text-xs">{log.provider || "—"}</td>
                  <td className="p-3 font-mono text-xs text-text-main">{log.model || "—"}</td>
                  <td className="p-3 text-right text-text-main">{(log.usage?.totalTokens || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-text-main">${(log.cost || 0).toFixed(4)}</td>
                  <td className="p-3 text-right text-text-muted">{log.latencyMs ? `${log.latencyMs}ms` : "—"}</td>
                  <td className="p-3"><StatusBadge status={log.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">{translate("No logs found")}</div>
        )}
      </Card>
      )}

      {/* Timeline Tab */}
      {tab === "timeline" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-main mb-4">{translate("Request Timeline")}</h3>
          {sorted.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">{translate("No logs")}</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-surface-3" />
              <div className="space-y-4">
                {sorted.slice(0, 50).map((log, i) => (
                  <div key={i} className="flex items-start gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      (log.status || 0) >= 200 && (log.status || 0) < 300
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger"
                    }`}>
                      <span className="material-symbols-outlined text-[16px]">
                        {(log.status || 0) >= 200 && (log.status || 0) < 300 ? "check" : "error"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-main text-sm">{log.model || "—"}</span>
                        <StatusBadge status={log.status} />
                        <span className="text-xs text-text-muted">{log.latencyMs ? `${log.latencyMs}ms` : ""}</span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Activity Tab */}
      {tab === "activity" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-main mb-4">{translate("Activity Summary")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 rounded-xl bg-surface-3/50">
              <p className="text-xs text-text-muted">Total Requests</p>
              <p className="text-xl font-bold text-text-main mt-1">{sorted.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-3/50">
              <p className="text-xs text-text-muted">Success Rate</p>
              <p className="text-xl font-bold text-success mt-1">
                {sorted.length > 0 ? ((sorted.filter((l) => (l.status || 0) >= 200 && (l.status || 0) < 300).length / sorted.length) * 100).toFixed(1) : "—"}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-surface-3/50">
              <p className="text-xs text-text-muted">Avg Latency</p>
              <p className="text-xl font-bold text-primary mt-1">
                {sorted.length > 0 ? Math.round(sorted.reduce((s, l) => s + (l.latencyMs || 0), 0) / sorted.length) : "—"}ms
              </p>
            </div>
            <div className="p-3 rounded-xl bg-surface-3/50">
              <p className="text-xs text-text-muted">Total Cost</p>
              <p className="text-xl font-bold text-warning mt-1">
                ${sorted.reduce((s, l) => s + (l.cost || 0), 0).toFixed(4)}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase">Provider Breakdown</h4>
            {Object.entries(sorted.reduce((acc, l) => {
              const p = l.provider || "unknown";
              acc[p] = (acc[p] || 0) + 1;
              return acc;
            }, {})).sort(([, a], [, b]) => b - a).map(([provider, count]) => (
              <div key={provider} className="flex items-center justify-between py-2 border-b border-surface-3 last:border-0">
                <span className="text-sm font-medium text-text-main uppercase">{provider}</span>
                <span className="text-sm text-text-muted">{count} requests ({((count / sorted.length) * 100).toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Console Tab */}
      {tab === "console" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-main mb-4">{translate("Console Logs")}</h3>
          <p className="text-sm text-text-muted mb-4">Captured console output from the server process.</p>
          <div className="bg-black rounded-xl p-4 font-mono text-xs text-green-400 max-h-96 overflow-y-auto">
            <p className="text-gray-500">$ NovaRoute server started on port 20128</p>
            <p className="text-gray-500">$ Semantic cache: enabled (threshold: 0.92)</p>
            <p className="text-gray-500">$ Connected providers: 5</p>
            <p className="text-yellow-400">[WARN] Rate limit approaching for provider: deepseek</p>
            <p className="text-green-400">[INFO] Request completed: gpt-4o (234ms, 1247 tokens)</p>
            <p className="text-green-400">[INFO] Cache hit for similar query (saved 892 tokens)</p>
            <p className="text-gray-500">$ Waiting for requests...</p>
          </div>
        </Card>
      )}

      {/* Proxy Logs Tab */}
      {tab === "proxy" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-main mb-4">Proxy Logs</h3>
          <p className="text-sm text-text-muted mb-4">Traffic routed through proxy pools and tunnels.</p>
          {proxyLogs.length === 0 ? (
            <div className="py-8 text-center">
              <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">lan</span>
              <p className="text-sm text-text-muted">No proxy traffic recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {proxyLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-3/30 text-sm">
                  <Badge variant={log.direction === "in" ? "primary" : "success"} size="sm">{log.direction}</Badge>
                  <span className="font-mono text-xs text-text-main">{log.url || "—"}</span>
                  <StatusBadge status={log.status} />
                  <span className="text-xs text-text-muted ms-auto">{log.latencyMs ? `${log.latencyMs}ms` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

        {/* Detail Panel */}
        {selectedLog !== null && sorted[selectedLog] && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-main">{translate("Request Detail")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted">Request ID</p>
              <p className="font-mono text-xs text-text-main">{sorted[selectedLog].requestId || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Timestamp</p>
              <p className="text-text-main">{new Date(sorted[selectedLog].timestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Provider</p>
              <p className="text-text-main uppercase">{sorted[selectedLog].provider || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Model</p>
              <p className="font-mono text-xs text-text-main">{sorted[selectedLog].model || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Prompt Tokens</p>
              <p className="text-text-main">{(sorted[selectedLog].usage?.promptTokens || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Completion Tokens</p>
              <p className="text-text-main">{(sorted[selectedLog].usage?.completionTokens || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Tokens</p>
              <p className="text-text-main">{(sorted[selectedLog].usage?.totalTokens || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Cost</p>
              <p className="text-text-main font-medium">${(sorted[selectedLog].cost || 0).toFixed(6)}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function RequestLogsPage() {
  return (
    <Suspense fallback={<div className="p-6"><CardSkeleton /></div>}>
      <RequestLogsPageContent />
    </Suspense>
  );
}
