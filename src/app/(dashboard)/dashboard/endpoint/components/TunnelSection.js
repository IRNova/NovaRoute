"use client";
import { useState, useEffect } from "react";
import NotImplementedNotice from "@/shared/components/NotImplementedNotice";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import Select from "@/shared/components/Select";

const TUNNEL_TYPES = [
  { value: "cloudflared", label: "Cloudflare Tunnel", icon: "cloud" },
  { value: "tailscale", label: "Tailscale Funnel", icon: "dns" },
  { value: "ngrok", label: "ngrok", icon: "lan" },
];

const SAMPLE_TUNNELS = [
  { id: "cloud", type: "cloudflared", name: "Cloudflare Tunnel", status: "inactive", url: "", publicUrl: "" },
  { id: "tailscale", type: "tailscale", name: "Tailscale Funnel", status: "inactive", url: "", publicUrl: "" },
  { id: "ng", type: "ngrok", name: "ngrok Tunnel", status: "inactive", url: "", publicUrl: "" },
];

export default function TunnelSection() {
  const [wired, setWired] = useState(true);
  const [tunnels, setTunnels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(null);
  const [config, setConfig] = useState({ port: "20128", hostname: "0.0.0.0", authtoken: "" });

  useEffect(() => {
    fetch("/api/tunnels")
      .then((r) => r.json())
      .then((d) => { setWired(d.implemented !== false); setTunnels(d.tunnels || SAMPLE_TUNNELS); setLoading(false); })
      .catch(() => { setTunnels(SAMPLE_TUNNELS); setLoading(false); });
  }, []);

  const handleStart = async (tunnelId) => {
    setTunnels(tunnels.map((t) => t.id === tunnelId ? { ...t, status: "starting" } : t));
    try {
      const res = await fetch(`/api/tunnels/${tunnelId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setTunnels(tunnels.map((t) => t.id === tunnelId ? { ...t, status: "active", url: data.url, publicUrl: data.publicUrl } : t));
    } catch {
      setTunnels(tunnels.map((t) => t.id === tunnelId ? { ...t, status: "inactive" } : t));
    }
  };

  const handleStop = async (tunnelId) => {
    setTunnels(tunnels.map((t) => t.id === tunnelId ? { ...t, status: "stopping" } : t));
    try {
      await fetch(`/api/tunnels/${tunnelId}/stop`, { method: "POST" });
      setTunnels(tunnels.map((t) => t.id === tunnelId ? { ...t, status: "inactive", url: "", publicUrl: "" } : t));
    } catch {
      setTunnels(tunnels.map((t) => t.id === tunnelId ? { ...t, status: "inactive" } : t));
    }
  };

  return (
    <Card className="p-5 space-y-4">
      {!wired && <NotImplementedNotice feature="Tunnels" />}
      <div>
        <h3 className="text-sm font-semibold text-text-main">Tunnel Configuration</h3>
        <p className="text-xs text-text-muted">Expose NovaRoute to the internet via secure tunnels</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Input placeholder="Port" value={config.port} onChange={(e) => setConfig({ ...config, port: e.target.value })} />
        <Input placeholder="Hostname" value={config.hostname} onChange={(e) => setConfig({ ...config, hostname: e.target.value })} />
        <Input placeholder="Auth Token (ngrok)" type="password" value={config.authtoken} onChange={(e) => setConfig({ ...config, authtoken: e.target.value })} />
      </div>

      <div className="space-y-3">
        {tunnels.map((t) => {
          const typeInfo = TUNNEL_TYPES.find((tt) => tt.value === t.type) || {};
          return (
            <div key={t.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-3/30">
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-[24px] ${t.status === "active" ? "text-success" : "text-text-muted"}`}>{typeInfo.icon || "tunnel"}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-main text-sm">{t.name}</span>
                    <Badge variant={t.status === "active" ? "success" : t.status === "starting" || t.status === "stopping" ? "warning" : "default"} size="sm">{t.status}</Badge>
                  </div>
                  {t.publicUrl && <p className="text-xs text-primary font-mono mt-0.5">{t.publicUrl}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {t.status === "active" ? (
                  <Button size="sm" variant="danger" onClick={() => handleStop(t.id)}>Stop</Button>
                ) : (
                  <Button size="sm" onClick={() => handleStart(t.id)} disabled={t.status === "starting"}>Start</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
