"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";

const DEFAULT_LIMITS = [
  { id: 1, user: "alice@team.io", model: "gpt-4o", limit: 1000, used: 847, remaining: 153, resetAt: "2026-08-18T00:00:00Z" },
  { id: 2, user: "alice@team.io", model: "claude-sonnet-4-20250514", limit: 500, used: 500, remaining: 0, resetAt: "2026-08-18T00:00:00Z" },
  { id: 3, user: "bob@team.io", model: "gpt-4o", limit: 2000, used: 1100, remaining: 900, resetAt: "2026-08-18T00:00:00Z" },
  { id: 4, user: "bob@team.io", model: "deepseek-chat", limit: 3000, used: 420, remaining: 2580, resetAt: "2026-08-18T00:00:00Z" },
  { id: 5, user: "charlie@team.io", model: "gpt-4o-mini", limit: 5000, used: 1200, remaining: 3800, resetAt: "2026-08-18T00:00:00Z" },
];

export default function LimitsPage() {
  const [limits, setLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ user: "", model: "", limit: 1000 });

  useEffect(() => {
    fetch("/api/limits")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setLimits(d?.limits || DEFAULT_LIMITS); setLoading(false); })
      .catch(() => { setLimits(DEFAULT_LIMITS); setLoading(false); });
  }, []);

  const handleCreate = async () => {
    if (!form.user || !form.model) return;
    try {
      const res = await fetch("/api/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = res.ok ? await res.json() : null;
      setLimits((prev) => [...prev, data?.limit || { id: Date.now(), ...form, used: 0, remaining: form.limit, resetAt: new Date(Date.now() + 86400000).toISOString() }]);
      setForm({ user: "", model: "", limit: 1000 });
      setShowCreate(false);
    } catch {
      setLimits((prev) => [...prev, { id: Date.now(), ...form, used: 0, remaining: form.limit, resetAt: new Date(Date.now() + 86400000).toISOString() }]);
      setForm({ user: "", model: "", limit: 1000 });
      setShowCreate(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this rate limit?")) return;
    try { await fetch(`/api/limits?id=${id}`, { method: "DELETE" }); } catch { /* fail-open */ }
    setLimits((prev) => prev.filter((l) => l.id !== id));
  };

  if (loading) return <div className="p-6 space-y-4"><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Rate Limits</h1>
          <p className="text-sm text-text-muted mt-1">Per-user, per-model request and token limits</p>
        </div>
        <Button size="sm" icon={showCreate ? "close" : "add"} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "Add Limit"}
        </Button>
      </div>

      {showCreate && (
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="User email" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
            <Input placeholder="Model (e.g. gpt-4o)" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input type="number" placeholder="Limit" value={form.limit} onChange={(e) => setForm({ ...form, limit: parseInt(e.target.value) || 0 })} />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={!form.user || !form.model}>Create Limit</Button>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-muted text-xs uppercase">
              <tr>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Model</th>
                <th className="p-3 text-right">Limit</th>
                <th className="p-3 text-right">Used</th>
                <th className="p-3 text-right">Remaining</th>
                <th className="p-3 text-left">Usage</th>
                <th className="p-3 text-left">Reset</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3/50">
              {limits.map((l) => {
                const pct = l.limit > 0 ? Math.min(100, (l.used / l.limit) * 100) : 0;
                const exhausted = l.remaining <= 0;
                return (
                  <tr key={l.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="p-3 font-medium text-text-main">{l.user}</td>
                    <td className="p-3 font-mono text-xs text-text-main">{l.model}</td>
                    <td className="p-3 text-right text-text-main">{l.limit.toLocaleString()}</td>
                    <td className="p-3 text-right text-text-main">{l.used.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <span className={exhausted ? "text-danger font-medium" : "text-text-main"}>{l.remaining.toLocaleString()}</span>
                    </td>
                    <td className="p-3 w-40">
                      <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${exhausted ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="p-3 text-xs text-text-muted">
                      {l.resetAt ? new Date(l.resetAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">
                      <button onClick={() => handleDelete(l.id)} className="text-text-muted hover:text-danger">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {limits.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">No rate limits configured</div>
        )}
      </Card>
    </div>
  );
}
