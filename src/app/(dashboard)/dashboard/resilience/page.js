"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";

const SAMPLE_DATA = {
  circuitBreakers: [
    { id: 1, name: "openai", state: "closed", failures: 0, threshold: 5, lastTrip: null, cooldownRemaining: 0 },
    { id: 2, name: "anthropic", state: "half-open", failures: 3, threshold: 5, lastTrip: Date.now() - 30000, cooldownRemaining: 12 },
    { id: 3, name: "deepseek", state: "open", failures: 5, threshold: 5, lastTrip: Date.now() - 5000, cooldownRemaining: 55 },
    { id: 4, name: "google", state: "closed", failures: 1, threshold: 5, lastTrip: null, cooldownRemaining: 0 },
  ],
  retryStats: {
    totalRetries: 342,
    successfulRetries: 298,
    failedRetries: 44,
    avgRetryLatency: 1850,
    retryRate: 4.7,
  },
  fallbackChains: [
    { id: 1, name: "Primary Chat", chain: ["openai", "anthropic", "google"], active: 0, healthy: 2, enabled: true },
    { id: 2, name: "Budget Fallback", chain: ["deepseek", "openai", "gemini"], active: 1, healthy: 1, enabled: true },
    { id: 3, name: "Code Generation", chain: ["anthropic", "deepseek", "openai"], active: 0, healthy: 3, enabled: false },
  ],
  degradedMode: {
    active: false,
    reason: null,
    activatedAt: null,
    actions: ["Reduced concurrency", "Disable streaming", "Skip non-essential providers"],
  },
};

const STATE_CONFIG = {
  closed: { icon: "check_circle", color: "text-success", variant: "success", label: "Closed" },
  "half-open": { icon: "warning", color: "text-warning", variant: "warning", label: "Half-Open" },
  open: { icon: "error", color: "text-danger", variant: "danger", label: "Open" },
};

function CircuitBreakerCard({ breaker, onReset }) {
  const s = STATE_CONFIG[breaker.state] || STATE_CONFIG.closed;
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-[24px] ${s.color}`}>{s.icon}</span>
          <div>
            <h3 className="font-semibold text-text-main font-mono">{breaker.name}</h3>
            <p className="text-xs text-text-muted">Threshold: {breaker.threshold} failures</p>
          </div>
        </div>
        <Badge variant={s.variant} size="sm">{s.label}</Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Failures</span>
          <span className="text-text-main">{breaker.failures} / {breaker.threshold}</span>
        </div>
        <div className="h-2 rounded-full bg-surface-3/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${s.color === "text-success" ? "bg-success" : s.color === "text-warning" ? "bg-warning" : "bg-danger"}`}
            style={{ width: `${(breaker.failures / breaker.threshold) * 100}%` }}
          />
        </div>
        {breaker.cooldownRemaining > 0 && (
          <p className="text-xs text-text-muted">
            Cooldown: <span className="font-mono text-warning">{breaker.cooldownRemaining}s</span> remaining
          </p>
        )}
      </div>

      {breaker.state !== "closed" && (
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => onReset(breaker.id)}>
          Reset
        </Button>
      )}
    </Card>
  );
}

export default function ResiliencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/resilience")
      .then((r) => r.json())
      .then((d) => setData(d.data || SAMPLE_DATA))
      .catch(() => setData(SAMPLE_DATA))
      .finally(() => setLoading(false));
  }, []);

  const handleReset = (id) => {
    setData((prev) => ({
      ...prev,
      circuitBreakers: prev.circuitBreakers.map((cb) =>
        cb.id === id ? { ...cb, state: "closed", failures: 0, cooldownRemaining: 0 } : cb
      ),
    }));
  };

  if (loading) return <div className="p-6 max-w-7xl mx-auto space-y-6"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  const d = data || SAMPLE_DATA;
  const openCount = d.circuitBreakers.filter((cb) => cb.state === "open").length;
  const halfOpenCount = d.circuitBreakers.filter((cb) => cb.state === "half-open").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">System Resilience</h1>
          <p className="text-sm text-text-muted mt-1">Circuit breakers, retry logic, and fallback chain status</p>
        </div>
        <div className="flex items-center gap-2">
          {openCount > 0 && <Badge variant="danger" size="sm">{openCount} tripped</Badge>}
          {halfOpenCount > 0 && <Badge variant="warning" size="sm">{halfOpenCount} half-open</Badge>}
          {openCount === 0 && halfOpenCount === 0 && (
            <span className="flex items-center gap-1.5 text-sm text-success font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
              All systems operational
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">electric_bolt</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Circuit Breakers</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-main">{d.circuitBreakers.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-warning">replay</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Total Retries</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-main">{d.retryStats.totalRetries}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-success">alt_route</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Fallback Chains</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-main">{d.fallbackChains.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-danger">health_and_safety</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Retry Success</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-success">{d.retryStats.totalRetries > 0 ? ((d.retryStats.successfulRetries / d.retryStats.totalRetries) * 100).toFixed(1) : 0}%</p>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Circuit Breakers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {d.circuitBreakers.map((cb) => (
            <CircuitBreakerCard key={cb.id} breaker={cb} onReset={handleReset} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-main">Retry Statistics</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl bg-surface-3/50">
              <p className="text-xs text-text-muted">Total Retries</p>
              <p className="text-xl font-bold text-text-main mt-1">{d.retryStats.totalRetries}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-3/50">
              <p className="text-xs text-text-muted">Successful</p>
              <p className="text-xl font-bold text-success mt-1">{d.retryStats.successfulRetries}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-3/50">
              <p className="text-xs text-text-muted">Failed</p>
              <p className="text-xl font-bold text-danger mt-1">{d.retryStats.failedRetries}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-3/50">
              <p className="text-xs text-text-muted">Retry Rate</p>
              <p className="text-xl font-bold text-primary mt-1">{d.retryStats.retryRate}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-main">Degraded Mode</h3>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant={d.degradedMode.active ? "danger" : "success"} size="sm">
              {d.degradedMode.active ? "Active" : "Inactive"}
            </Badge>
            {d.degradedMode.reason && <span className="text-xs text-text-muted">{d.degradedMode.reason}</span>}
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Available Actions:</p>
            {d.degradedMode.actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-text-muted">
                <span className="material-symbols-outlined text-[14px] text-text-muted">arrow_right</span>
                {a}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-main">Fallback Chains</h3>
        <div className="space-y-3">
          {d.fallbackChains.map((chain) => (
            <div key={chain.id} className="flex items-center gap-4 p-3 rounded-xl bg-surface-3/30">
              <div className="flex items-center gap-2 min-w-[140px]">
                <span className="material-symbols-outlined text-[18px] text-primary">alt_route</span>
                <span className="font-medium text-text-main text-sm">{chain.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                {chain.chain.map((provider, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="material-symbols-outlined text-[14px] text-text-muted">arrow_forward</span>}
                    <Badge
                      variant={i === chain.active ? "primary" : "default"}
                      size="sm"
                    >
                      {provider}
                    </Badge>
                  </div>
                ))}
              </div>
              <Badge variant={chain.healthy === chain.chain.length ? "success" : chain.healthy > 0 ? "warning" : "danger"} size="sm">
                {chain.healthy}/{chain.chain.length} healthy
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
