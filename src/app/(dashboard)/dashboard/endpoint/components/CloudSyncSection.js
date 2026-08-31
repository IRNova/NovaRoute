"use client";
import { useState, useEffect } from "react";
import NotImplementedNotice from "@/shared/components/NotImplementedNotice";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import Badge from "@/shared/components/Badge";

export default function CloudSyncSection() {
  const [wired, setWired] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [cloudUrl, setCloudUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch("/api/cloud-sync")
      .then((r) => r.json())
      .then((d) => {
        setWired(d.implemented !== false);
        setEnabled(d.enabled || false);
        setCloudUrl(d.cloudUrl || "");
        setLastSync(d.lastSync || null);
        setStatus(d.status || null);
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (val) => {
    setEnabled(val);
    try {
      await fetch("/api/cloud-sync", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: val }),
      });
    } catch { /* fail-open */ }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/cloud-sync", { method: "POST" });
      const data = await res.json();
      setLastSync(new Date().toISOString());
      setStatus(data.status || "synced");
    } catch { /* fail-open */ } finally { setSyncing(false); }
  };

  return (
    <Card className="p-5 space-y-4">
      {!wired && <NotImplementedNotice feature="Cloud sync" />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">cloud_sync</span>
          <h3 className="text-sm font-semibold text-text-main">Cloud Sync</h3>
        </div>
        <Badge variant={enabled ? "success" : "default"} size="sm">{enabled ? "Enabled" : "Disabled"}</Badge>
      </div>
      <p className="text-xs text-text-muted">Sync your configuration, API keys, and usage data to cloud for multi-device access.</p>

      <div className="space-y-3">
        <Toggle checked={enabled} onChange={handleToggle} label="Enable Cloud Sync" />
        {enabled && (
          <>
            <Input
              label="Cloud URL"
              placeholder="https://your-cloud.example.com"
              value={cloudUrl}
              onChange={(e) => setCloudUrl(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              {lastSync && (
                <span className="text-xs text-text-muted">Last sync: {new Date(lastSync).toLocaleString()}</span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
