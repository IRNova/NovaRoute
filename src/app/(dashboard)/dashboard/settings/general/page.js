"use client";
import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";
import Input from "@/shared/components/Input";
import { useSettings } from "../SettingsShell";

function Section({ title, description, children }) {
  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-main">{title}</h3>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </Card>
  );
}

function FieldRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-main">{label}</p>
        {description && (
          <p className="text-xs text-text-muted">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function GeneralSettingsPage() {
  const { settings, save } = useSettings();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backing, setBacking] = useState(false);
  const [purging, setPurging] = useState(false);
  const [vacuuming, setVacuuming] = useState(false);

  if (!settings) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/settings/database?action=export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `novaroute-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fail-open
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await fetch("/api/settings/database?action=import", { method: "POST", body: form });
      window.location.reload();
    } catch {
      // fail-open
    } finally {
      setImporting(false);
    }
  };

  const handleBackup = async () => {
    setBacking(true);
    try {
      const res = await fetch("/api/settings/database?action=backup");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `novaroute-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fail-open
    } finally {
      setBacking(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm("This will permanently delete ALL usage history and request logs. Continue?")) return;
    setPurging(true);
    try {
      await fetch("/api/settings/database?action=purge", { method: "POST" });
      window.location.reload();
    } catch {
      // fail-open
    } finally {
      setPurging(false);
    }
  };

  const handleVacuum = async () => {
    setVacuuming(true);
    try {
      await fetch("/api/settings/database?action=vacuum", { method: "POST" });
    } catch {
      // fail-open
    } finally {
      setVacuuming(false);
    }
  };

  return (
    <div className="space-y-6">
      <Section title="Storage" description="Database operations and backup management">
        <div className="space-y-2">
          <FieldRow label="Export Database" description="Download a full copy of the database">
            <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Export"}
            </Button>
          </FieldRow>
          <FieldRow label="Import Database" description="Restore from a previously exported .db file">
            <label className="cursor-pointer">
              <input type="file" accept=".db" className="hidden" onChange={handleImport} />
              <Button size="sm" variant="outline" as="span" disabled={importing}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </label>
          </FieldRow>
          <FieldRow label="Create Backup" description="Save current state as JSON (excludes request details)">
            <Button size="sm" variant="outline" onClick={handleBackup} disabled={backing}>
              {backing ? "Backing up..." : "Backup"}
            </Button>
          </FieldRow>
          <FieldRow label="Vacuum Database" description="Reclaim unused space and optimize performance">
            <Button size="sm" variant="outline" onClick={handleVacuum} disabled={vacuuming}>
              {vacuuming ? "Vacuuming..." : "Vacuum"}
            </Button>
          </FieldRow>
          <FieldRow label="Purge History" description="Delete all usage history and request logs (irreversible)">
            <Button size="sm" variant="danger" onClick={handlePurge} disabled={purging}>
              {purging ? "Purging..." : "Purge"}
            </Button>
          </FieldRow>
        </div>
      </Section>

      <BackupsSection />

      <Section title="Backup Retention" description="How many backup files to keep">
        <FieldRow
          label="Max Backups"
          description="Older backups are automatically pruned when this limit is reached"
        >
          <Input
            type="number"
            min={1}
            max={50}
            value={settings.backupRetention ?? 3}
            onChange={(e) => save({ backupRetention: parseInt(e.target.value) || 3 })}
            className="w-20 text-center"
          />
        </FieldRow>
      </Section>

      <Section title="Local-First Routing" description="Auto-detect and use local AI runtimes (Ollama, LM Studio, llama.cpp)">
        <FieldRow
          label="Enable Local-First"
          description="Automatically detect and route to local runtimes when available"
        >
          <Toggle
            checked={settings.localFirst?.enabled ?? false}
            onChange={(val) => save({ localFirst: { ...(settings.localFirst || {}), enabled: val } })}
          />
        </FieldRow>
      </Section>
    </div>
  );
}

// ─── Automatic daily backups: list + one-click restore ────────────────────
function BackupsSection() {
  const [backups, setBackups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState("");

  const load = () =>
    fetch("/api/settings/database/backups")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBackups(Array.isArray(d?.backups) ? d.backups : []))
      .catch(() => {})
      .finally(() => setLoaded(true));

  useEffect(() => {
    load();
  }, []);

  const restore = async (name) => {
    if (!window.confirm(`Restore "${name}"? Current data is snapshotted first, then overwritten. A service restart is recommended afterwards.`)) return;
    setBusy(name);
    setMessage("");
    try {
      const res = await fetch("/api/settings/database/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Restore failed");
      setMessage(`Restored ${d.restoredTables} tables from ${name}. Restart the service when convenient.`);
      load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) return null;

  return (
    <Section
      title="Automatic Backups"
      description="Daily snapshots (kept: 7). Restoring replaces current tables — a fresh snapshot of the present state is saved first."
    >
      {message && <p className="text-xs text-text-muted bg-surface-3/50 border border-border-subtle rounded-lg p-2">{message}</p>}
      {backups.length === 0 ? (
        <p className="text-sm text-text-muted">No automatic backups yet — the first runs shortly after boot, then every 24h.</p>
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <div key={b.name} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
              <div className="min-w-0">
                <p className="text-sm font-mono text-text-main truncate" dir="ltr">{b.name}</p>
                <p className="text-xs text-text-muted" dir="ltr">
                  {b.createdAt ? new Date(b.createdAt).toLocaleString() : "—"} · {b.sizeMB} MB
                </p>
              </div>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => restore(b.name)}>
                {busy === b.name ? "Restoring..." : "Restore"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
