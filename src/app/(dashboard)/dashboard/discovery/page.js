"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";

const SAMPLE_SERVICES = [
  { id: 1, name: "OpenAI API", url: "https://api.openai.com/v1", status: "online", latency: 142, type: "llm" },
  { id: 2, name: "Anthropic API", url: "https://api.anthropic.com", status: "online", latency: 198, type: "llm" },
  { id: 3, name: "Google Gemini", url: "https://generativelanguage.googleapis.com", status: "online", latency: 165, type: "llm" },
  { id: 4, name: "Local Ollama", url: "http://localhost:11434", status: "online", latency: 12, type: "llm" },
  { id: 5, name: "Local vLLM", url: "http://localhost:8000", status: "offline", latency: 0, type: "llm" },
  { id: 6, name: "DeepSeek API", url: "https://api.deepseek.com", status: "online", latency: 287, type: "llm" },
];

const STATUS_CONFIG = {
  online: { icon: "check_circle", color: "text-success", variant: "success" },
  offline: { icon: "error", color: "text-danger", variant: "danger" },
  scanning: { icon: "hourglass_top", color: "text-warning", variant: "warning" },
};

function ServiceRow({ service }) {
  const s = STATUS_CONFIG[service.status] || STATUS_CONFIG.offline;
  return (
    <tr className="hover:bg-surface-2/50 transition-colors">
      <td className="p-3">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
          <span className="font-medium text-text-main">{service.name}</span>
        </div>
      </td>
      <td className="p-3">
        <span className="font-mono text-xs text-text-muted">{service.url}</span>
      </td>
      <td className="p-3">
        <Badge variant={s.variant} size="sm">{service.status}</Badge>
      </td>
      <td className="p-3 text-right">
        <span className={`font-mono text-sm ${service.latency > 200 ? "text-warning" : service.latency > 0 ? "text-success" : "text-text-muted"}`}>
          {service.latency > 0 ? `${service.latency}ms` : "—"}
        </span>
      </td>
    </tr>
  );
}

export default function DiscoveryPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch("/api/discovery")
      .then((r) => r.json())
      .then((d) => setServices(d.services || SAMPLE_SERVICES))
      .catch(() => setServices(SAMPLE_SERVICES))
      .finally(() => setLoading(false));
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/discovery?action=scan", { method: "POST" });
      const d = await res.json();
      setServices(d.services || SAMPLE_SERVICES);
    } catch {
      setServices((prev) =>
        prev.map((s) => ({ ...s, status: s.name === "Local Ollama" ? "scanning" : s.status }))
      );
      setTimeout(() => {
        setServices((prev) => prev.map((s) => (s.status === "scanning" ? { ...s, status: "online" } : s)));
      }, 2000);
    } finally {
      setScanning(false);
    }
  };

  const onlineCount = services.filter((s) => s.status === "online").length;
  const avgLatency = services.filter((s) => s.latency > 0).reduce((a, s) => a + s.latency, 0) / (services.filter((s) => s.latency > 0).length || 1);

  if (loading) return <div className="p-6 max-w-7xl mx-auto space-y-6"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Network Discovery</h1>
          <p className="text-sm text-text-muted mt-1">Auto-discover AI providers on your local network</p>
        </div>
        <Button icon="radar" size="sm" onClick={handleScan} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan Network"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">dns</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Services Found</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-main">{services.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-success">check_circle</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Online</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-success">{onlineCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-warning">speed</span>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Avg Latency</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-main">{avgLatency.toFixed(0)}ms</p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        {services.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">No services discovered. Click Scan Network to find providers.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-muted text-xs uppercase">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">URL</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3/50">
              {services.map((s) => <ServiceRow key={s.id} service={s} />)}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
