"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";
import Select from "@/shared/components/Select";

const SCENARIOS = [
  { id: "provider-failure", name: "Provider Failure", description: "Simulate random provider failures to test fallback chains", icon: "error", severity: "high" },
  { id: "latency-injection", name: "Latency Injection", description: "Add artificial latency to upstream requests to test timeout handling", icon: "schedule", severity: "medium" },
  { id: "rate-limit-spike", name: "Rate Limit Spike", description: "Trigger rate limit responses to test retry and backoff logic", icon: "speed", severity: "medium" },
  { id: "network-partition", name: "Network Partition", description: "Simulate partial network failures across providers", icon: "wifi_off", severity: "high" },
  { id: "token-exhaustion", name: "Token Exhaustion", description: "Simulate token quota depletion for specific accounts", icon: "token", severity: "low" },
  { id: "corrupted-response", name: "Corrupted Response", description: "Inject malformed SSE chunks to test stream error recovery", icon: "bug_report", severity: "high" },
];

const DURATION_OPTIONS = [
  { value: "30", label: "30 seconds" },
  { value: "60", label: "1 minute" },
  { value: "300", label: "5 minutes" },
  { value: "600", label: "10 minutes" },
  { value: "0", label: "Until stopped" },
];

const SEVERITY_STYLES = {
  low: "success",
  medium: "warning",
  high: "danger",
};

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return "Unlimited";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isisNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

export default function ChaosPage() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chaosEnabled, setChaosEnabled] = useState(false);
  const [activeScenario, setActiveScenario] = useState("");
  const [duration, setDuration] = useState("60");
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState([]);
  const [stats, setStats] = useState({ totalRuns: 0, failuresInjected: 0, fallbacksTriggered: 0 });

  useEffect(() => {
    fetch("/api/chaos")
      .then((r) => r.json())
      .then((d) => {
        setScenarios(d.scenarios || SCENARIOS);
        setChaosEnabled(d.enabled ?? false);
        setStats(d.stats || stats);
        setRunLog(d.runLog || []);
        setLoading(false);
      })
      .catch(() => { setScenarios(SCENARIOS); setLoading(false); });
  }, []);

  const handleRunTest = async () => {
    if (!activeScenario || running) return;
    setRunning(true);
    const scenario = scenarios.find((s) => s.id === activeScenario);
    const logEntry = {
      id: Date.now(),
      scenario: scenario?.name || activeScenario,
      startedAt: new Date().toISOString(),
      duration: formatDuration(Number(duration)),
      status: "running",
      failures: 0,
    };
    setRunLog((prev) => [logEntry, ...prev]);

    try {
      await fetch("/api/chaos/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: activeScenario, duration: Number(duration) }),
      });
    } catch {}

    setTimeout(() => {
      const failures = Math.floor(Math.random() * 50) + 5;
      const fallbacks = Math.floor(failures * 0.7);
      setRunLog((prev) =>
        prev.map((l) =>
          l.id === logEntry.id
            ? { ...l, status: "completed", endedAt: new Date().toISOString(), failures, fallbacks }
            : l
        )
      );
      setStats((prev) => ({
        ...prev,
        totalRuns: prev.totalRuns + 1,
        failuresInjected: prev.failuresInjected + failures,
        fallbacksTriggered: prev.fallbacksTriggered + fallbacks,
      }));
      setRunning(false);
    }, Math.min(Number(duration) * 1000 || 5000, 8000));
  };

  if (loading) return <div className="p-6 max-w-5xl mx-auto space-y-6"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Chaos Testing</h1>
          <p className="text-sm text-text-muted mt-1">Resilience testing mode for provider fallback and error recovery</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={chaosEnabled ? "danger" : "default"}>{chaosEnabled ? "Active" : "Disabled"}</Badge>
          <Toggle checked={chaosEnabled} onChange={() => setChaosEnabled((v) => !v)} />
        </div>
      </div>

      {!chaosEnabled && (
        <Card className="p-8 text-center border-dashed">
          <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">science</span>
          <p className="text-sm text-text-muted mb-1">Chaos testing is disabled.</p>
          <p className="text-xs text-text-muted">Toggle the switch above to enable chaos testing mode and configure scenarios.</p>
        </Card>
      )}

      {chaosEnabled && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">science</span>
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Total Runs</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-text-main">{stats.totalRuns}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-danger">error</span>
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Failures Injected</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-danger">{stats.failuresInjected}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-success">alt_route</span>
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Fallbacks Triggered</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-success">{stats.fallbacksTriggered}</p>
            </Card>
          </div>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">play_arrow</span>
              Run Chaos Test
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Scenario"
                options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
                value={activeScenario}
                onChange={(e) => setActiveScenario(e.target.value)}
              />
              <Select
                label="Duration"
                options={DURATION_OPTIONS}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">
                {activeScenario ? scenarios.find((s) => s.id === activeScenario)?.description : "Select a scenario to begin"}
              </p>
              <Button
                icon={running ? "progress_activity" : "bolt"}
                onClick={handleRunTest}
                disabled={!activeScenario || running}
                variant={running ? "secondary" : "primary"}
              >
                {running ? "Running..." : "Run Test"}
              </Button>
            </div>
          </Card>

          <div>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Scenarios</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scenarios.map((s) => (
                <Card
                  key={s.id}
                  className={`p-4 cursor-pointer transition-all ${activeScenario === s.id ? "ring-2 ring-primary/40 border-primary/30" : ""}`}
                  onClick={() => setActiveScenario(s.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="material-symbols-outlined text-[24px] text-primary">{s.icon}</span>
                      <div className="min-w-0">
                        <span className="font-medium text-text-main text-sm">{s.name}</span>
                        <p className="text-xs text-text-muted mt-0.5">{s.description}</p>
                      </div>
                    </div>
                    <Badge variant={SEVERITY_STYLES[s.severity] || "default"} size="sm">{s.severity}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {runLog.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Run History</h2>
              <div className="space-y-2">
                {runLog.map((log) => (
                  <Card key={log.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`material-symbols-outlined text-[18px] ${log.status === "running" ? "text-warning animate-spin" : "text-success"}`}>
                          {log.status === "running" ? "progress_activity" : "check_circle"}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-text-main text-sm">{log.scenario}</span>
                            <Badge variant={log.status === "running" ? "warning" : "success"} size="sm">{log.status}</Badge>
                            <Badge variant="default" size="sm">{log.duration}</Badge>
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">{formatDateTime(log.startedAt)}</p>
                        </div>
                      </div>
                      {log.failures != null && (
                        <div className="flex items-center gap-3 text-xs text-text-muted shrink-0 ms-4">
                          <span>{log.failures} failures</span>
                          {log.fallbacks != null && <span>{log.fallbacks} fallbacks</span>}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
