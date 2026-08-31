"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";

export default function MCPPage() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mcp")
      .then((r) => r.json())
      .then((d) => { setServers(d.servers || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4"><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">MCP Servers</h1>
          <p className="text-sm text-text-muted mt-1">Manage Model Context Protocol servers</p>
        </div>
        <Button>+ Add Server</Button>
      </div>

      {servers.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">dns</span>
          <p className="text-sm text-text-muted">No MCP servers configured. Add one to extend NovaRoute's capabilities.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {servers.map((s) => (
            <Card key={s.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${s.status === "connected" ? "bg-success" : "bg-text-muted"}`} />
                <div>
                  <span className="font-medium text-text-main">{s.name}</span>
                  <p className="text-xs text-text-muted">{s.transport || "stdio"} · {s.tools || 0} tools</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.status === "connected" ? "success" : "default"} size="sm">{s.status || "disconnected"}</Badge>
                <Toggle checked={s.enabled ?? false} onChange={async () => {
                  try {
                    const res = await fetch("/api/mcp/servers/" + encodeURIComponent(s.id), {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ enabled: !(s.enabled ?? false) }),
                    });
                    if (res.ok) {
                      setServers((prev) => prev.map((sv) => sv.id === s.id ? { ...sv, enabled: !(sv.enabled ?? false) } : sv));
                    }
                  } catch {}
                }} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
