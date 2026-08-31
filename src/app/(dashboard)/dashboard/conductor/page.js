"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Select from "@/shared/components/Select";

const SAMPLE_CHAINS = [
  {
    id: "c1",
    name: "gpt-4o-primary",
    model: "gpt-4o",
    primary: "openai",
    fallbacks: ["azure-openai", "openai-compat"],
    status: "healthy",
    lastRoute: "12s ago",
    successRate: 99.7,
  },
  {
    id: "c2",
    name: "claude-sonnet",
    model: "claude-sonnet-4-20250514",
    primary: "anthropic",
    fallbacks: ["openai-compat"],
    status: "healthy",
    lastRoute: "45s ago",
    successRate: 99.2,
  },
  {
    id: "c3",
    name: "gemini-flash",
    model: "gemini-2.0-flash",
    primary: "google",
    fallbacks: ["vertex-ai", "openai-compat"],
    status: "degraded",
    lastRoute: "2m ago",
    successRate: 94.1,
  },
  {
    id: "c4",
    name: "llama-free",
    model: "llama-3.1-70b",
    primary: "groq",
    fallbacks: ["together", "fireworks"],
    status: "healthy",
    lastRoute: "30s ago",
    successRate: 98.5,
  },
  {
    id: "c5",
    name: "mistral-enterprise",
    model: "mistral-large",
    primary: "mistral",
    fallbacks: ["azure-mistral"],
    status: "down",
    lastRoute: "5m ago",
    successRate: 62.3,
  },
];

const SAMPLE_RECENT = [
  { time: "14:32:01", model: "gpt-4o", routed: "openai", latency: "342ms", status: "success" },
  { time: "14:31:58", model: "claude-sonnet-4-20250514", routed: "anthropic", latency: "218ms", status: "success" },
  { time: "14:31:55", model: "gemini-2.0-flash", routed: "google", latency: "190ms", status: "success" },
  { time: "14:31:50", model: "gemini-2.0-flash", routed: "vertex-ai", latency: "412ms", status: "fallback" },
  { time: "14:31:42", model: "mistral-large", routed: "mistral", latency: "5200ms", status: "failed" },
  { time: "14:31:40", model: "mistral-large", routed: "azure-mistral", latency: "289ms", status: "success" },
  { time: "14:31:30", model: "llama-3.1-70b", routed: "groq", latency: "98ms", status: "success" },
  { time: "14:31:25", model: "gpt-4o", routed: "openai", latency: "401ms", status: "success" },
];

const STATUS_META = {
  healthy: { variant: "success", icon: "check_circle", color: "text-success" },
  degraded: { variant: "warning", icon: "warning", color: "text-warning" },
  down: { variant: "error", icon: "error", color: "text-danger" },
};

function FlowDiagram({ chain }) {
  const meta = STATUS_META[chain.status] || STATUS_META.healthy;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
        <span className="material-symbols-outlined text-[14px] text-primary">smart_toy</span>
        <span className="text-xs font-medium text-text-main">{chain.model}</span>
      </div>
      <span className="material-symbols-outlined text-[16px] text-text-muted">arrow_forward</span>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 border border-success/20">
        <span className="material-symbols-outlined text-[14px] text-success">dns</span>
        <span className="text-xs font-medium text-text-main">{chain.primary}</span>
      </div>
      {chain.fallbacks.map((fb, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] text-text-muted">arrow_forward</span>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 border border-border-subtle">
            <span className="text-xs text-text-muted">{fb}</span>
          </div>
        </span>
      ))}
    </div>
  );
}

function ChainRow({ chain, onSelect }) {
  const meta = STATUS_META[chain.status] || STATUS_META.healthy;
  return (
    <tr
      className="hover:bg-surface-2/50 transition-colors cursor-pointer"
      onClick={() => onSelect(chain)}
    >
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-[18px] ${meta.color}`}>{meta.icon}</span>
          <span className="font-medium text-sm text-text-main">{chain.name}</span>
        </div>
      </td>
      <td className="p-3">
        <span className="font-mono text-xs text-text-muted">{chain.model}</span>
      </td>
      <td className="p-3">
        <FlowDiagram chain={chain} />
      </td>
      <td className="p-3 text-right">
        <Badge variant={meta.variant} size="sm" dot>
          {chain.status}
        </Badge>
      </td>
      <td className="p-3 text-right">
        <span className="font-mono text-xs text-text-muted">{chain.lastRoute}</span>
      </td>
      <td className="p-3 text-right">
        <span className={`font-mono text-sm font-medium ${chain.successRate >= 95 ? "text-success" : chain.successRate >= 80 ? "text-warning" : "text-danger"}`}>
          {chain.successRate}%
        </span>
      </td>
    </tr>
  );
}

export default function ConductorPage() {
  const [chains, setChains] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState(null);
  const [view, setView] = useState("chains");

  useEffect(() => {
    fetch("/api/conductor")
      .then((r) => r.json())
      .then((d) => {
        setChains(d.chains || SAMPLE_CHAINS);
        setRecent(d.recent || SAMPLE_RECENT);
      })
      .catch(() => {
        setChains(SAMPLE_CHAINS);
        setRecent(SAMPLE_RECENT);
      })
      .finally(() => setLoading(false));
  }, []);

  const healthyCount = chains.filter((c) => c.status === "healthy").length;
  const degradedCount = chains.filter((c) => c.status === "degraded").length;
  const downCount = chains.filter((c) => c.status === "down").length;
  const avgSuccess = chains.length
    ? (chains.reduce((a, c) => a + c.successRate, 0) / chains.length).toFixed(1)
    : 0;

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Conductor</h1>
          <p className="text-sm text-text-muted mt-1">Multi-provider orchestration and routing decisions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "chains" ? "secondary" : "ghost"}
            size="sm"
            icon="route"
            onClick={() => setView("chains")}
          >
            Chains
          </Button>
          <Button
            variant={view === "recent" ? "secondary" : "ghost"}
            size="sm"
            icon="history"
            onClick={() => setView("recent")}
          >
            Recent
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-success">check_circle</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Healthy</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-success">{healthyCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-warning">warning</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Degraded</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-warning">{degradedCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-danger">error</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Down</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-danger">{downCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">speed</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Avg Success</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">{avgSuccess}%</p>
        </Card>
      </div>

      {view === "chains" && (
        <>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-text-main mb-4">Routing Flow</h3>
            <div className="flex items-center justify-center gap-3 flex-wrap py-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-primary">person</span>
                </div>
                <span className="text-xs font-medium text-text-muted">Client</span>
              </div>
              <span className="material-symbols-outlined text-[24px] text-text-muted">arrow_forward</span>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-primary">hub</span>
                </div>
                <span className="text-xs font-medium text-text-muted">Gateway</span>
              </div>
              <span className="material-symbols-outlined text-[24px] text-text-muted">arrow_forward</span>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-info/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-info">translate</span>
                </div>
                <span className="text-xs font-medium text-text-muted">Translator</span>
              </div>
              <span className="material-symbols-outlined text-[24px] text-text-muted">arrow_forward</span>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-success">dns</span>
                </div>
                <span className="text-xs font-medium text-text-muted">Provider</span>
              </div>
              <span className="material-symbols-outlined text-[24px] text-text-muted">arrow_forward</span>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px] text-warning">fallback</span>
                </div>
                <span className="text-xs font-medium text-text-muted">Fallback</span>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            {chains.length === 0 ? (
              <div className="py-12 text-center text-sm text-text-muted">
                No routing chains configured.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-text-muted text-xs uppercase">
                  <tr>
                    <th className="p-3 text-left">Chain</th>
                    <th className="p-3 text-left">Model</th>
                    <th className="p-3 text-left">Route</th>
                    <th className="p-3 text-right">Status</th>
                    <th className="p-3 text-right">Last Route</th>
                    <th className="p-3 text-right">Success Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-3/50">
                  {chains.map((chain) => (
                    <ChainRow
                      key={chain.id}
                      chain={chain}
                      onSelect={setSelectedChain}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {view === "recent" && (
        <Card className="overflow-hidden p-0">
          {recent.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-muted">
              No recent routing decisions.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-muted text-xs uppercase">
                <tr>
                  <th className="p-3 text-left">Time</th>
                  <th className="p-3 text-left">Model</th>
                  <th className="p-3 text-left">Routed To</th>
                  <th className="p-3 text-right">Latency</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-3/50">
                {recent.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2/50 transition-colors">
                    <td className="p-3">
                      <span className="font-mono text-xs text-text-muted">{r.time}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs text-text-main">{r.model}</span>
                    </td>
                    <td className="p-3">
                      <Badge variant="info" size="sm">{r.routed}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-mono text-xs text-text-muted">{r.latency}</span>
                    </td>
                    <td className="p-3 text-right">
                      <Badge
                        variant={r.status === "success" ? "success" : r.status === "fallback" ? "warning" : "error"}
                        size="sm"
                        dot
                      >
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {selectedChain && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-main">Chain Details: {selectedChain.name}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedChain(null)}>
              Close
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted">Model</p>
              <p className="font-mono font-medium text-text-main">{selectedChain.model}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Primary Provider</p>
              <p className="font-medium text-text-main">{selectedChain.primary}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Fallback Chain</p>
              <p className="font-medium text-text-main">{selectedChain.fallbacks.join(" → ")}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Success Rate</p>
              <p className={`font-medium ${selectedChain.successRate >= 95 ? "text-success" : selectedChain.successRate >= 80 ? "text-warning" : "text-danger"}`}>
                {selectedChain.successRate}%
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
