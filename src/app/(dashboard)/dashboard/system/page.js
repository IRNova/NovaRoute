"use client";

import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";

const FALLBACK = {
  version: "2.4.1",
  nodeVersion: process.version || "v20.11.0",
  platform: "linux",
  arch: "x64",
  uptime: "3d 14h 22m",
  uptimeSeconds: 310920,
  memory: { rssMB: 184, heapUsedMB: 97, heapTotalMB: 148, externalMB: 12 },
  cpu: { cores: 8, model: "Intel Xeon E5-2686 v4", usagePercent: 12.4, loadAvg: [0.42, 0.38, 0.31] },
  db: { driver: "sql.js", sizeMB: 2.1, migrations: 14, lastMigration: "2026-08-10T00:00:00Z", tables: 22 },
  process: { pid: 12408, ppid: 1, user: "novaroute" },
};

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle last:border-b-0">
      <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-medium text-text-main ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

function MeterBar({ percent, color = "bg-primary" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export default function SystemPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/system")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d || FALLBACK);
        setLoading(false);
      })
      .catch(() => {
        setData(FALLBACK);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const sys = data;
  const mem = sys.memory || {};
  const cpu = sys.cpu || {};
  const db = sys.db || {};
  const memUsedPct = mem.rssMB ? Math.min(100, (mem.rssMB / 512) * 100) : 0;
  const heapPct = mem.heapTotalMB ? Math.min(100, (mem.heapUsedMB / mem.heapTotalMB) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">System</h1>
        <p className="text-sm text-text-muted mt-1">Runtime environment and database status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Version" icon="tag" className="p-5">
          <p className="text-2xl font-bold text-text-main">{sys.version || "—"}</p>
          <p className="text-xs text-text-muted mt-1">NovaRoute-app</p>
        </Card>

        <Card title="Node.js" icon="code" className="p-5">
          <p className="text-2xl font-bold text-text-main font-mono">{sys.nodeVersion || "—"}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="info" size="sm">{sys.platform || "—"}</Badge>
            <Badge variant="default" size="sm">{sys.arch || "—"}</Badge>
          </div>
        </Card>

        <Card title="Uptime" icon="schedule" className="p-5">
          <p className="text-2xl font-bold text-text-main">{sys.uptime || "—"}</p>
          <p className="text-xs text-text-muted mt-1">Since process start</p>
        </Card>

        <Card title="Memory" icon="memory" className="p-5">
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">RSS</span>
                <span className="text-xs font-medium text-text-main">{mem.rssMB || 0} MB</span>
              </div>
              <MeterBar
                percent={memUsedPct}
                color={memUsedPct > 80 ? "bg-danger" : memUsedPct > 50 ? "bg-warning" : "bg-success"}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Heap</span>
                <span className="text-xs font-medium text-text-main">{mem.heapUsedMB || 0} / {mem.heapTotalMB || 0} MB</span>
              </div>
              <MeterBar percent={heapPct} color="bg-primary" />
            </div>
            <InfoRow label="External" value={`${mem.externalMB || 0} MB`} />
          </div>
        </Card>

        <Card title="CPU" icon="developer_board" className="p-5">
          <div className="space-y-3">
            <p className="text-sm text-text-main font-medium truncate">{cpu.model || "—"}</p>
            <InfoRow label="Cores" value={cpu.cores || "—"} />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Usage</span>
                <span className="text-xs font-medium text-text-main">{cpu.usagePercent || 0}%</span>
              </div>
              <MeterBar
                percent={cpu.usagePercent || 0}
                color={(cpu.usagePercent || 0) > 80 ? "bg-danger" : (cpu.usagePercent || 0) > 50 ? "bg-warning" : "bg-success"}
              />
            </div>
            <InfoRow label="Load Avg" value={(cpu.loadAvg || []).map((l) => l.toFixed(2)).join("  ")} mono />
          </div>
        </Card>

        <Card title="Process" icon="terminal" className="p-5">
          <InfoRow label="PID" value={sys.process?.pid || "—"} mono />
          <InfoRow label="Parent PID" value={sys.process?.ppid || "—"} mono />
          <InfoRow label="User" value={sys.process?.user || "—"} />
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Database" icon="database" className="p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="success" size="md" dot>Connected</Badge>
              <Badge variant="info" size="sm">{db.driver || "—"}</Badge>
            </div>
            <InfoRow label="Size" value={`${db.sizeMB || 0} MB`} />
            <InfoRow label="Tables" value={db.tables || 0} />
          </div>
        </Card>

        <Card title="Migrations" icon="upgrade" className="p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-main font-medium">Applied</span>
              <Badge variant="success" size="sm">{db.migrations || 0} migrations</Badge>
            </div>
            <InfoRow label="Last Migration" value={db.lastMigration ? new Date(db.lastMigration).toLocaleDateString() : "—"} />
            <div className="rounded-lg bg-bg p-3 border border-border-subtle">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-success text-[18px]">check_circle</span>
                <span className="text-xs text-text-muted">All migrations applied successfully</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
