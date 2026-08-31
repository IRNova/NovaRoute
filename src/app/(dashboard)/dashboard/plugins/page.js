"use client";
import { translate } from "@/i18n/runtime";
import { useState, useEffect } from "react";
import Link from "next/link";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Toggle from "@/shared/components/Toggle";

export default function PluginsPage() {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plugins")
      .then((r) => r.json())
      .then((d) => { setPlugins(d.plugins || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const togglePlugin = (id) => {
    const next = plugins.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    setPlugins(next);
    const p = next.find((x) => x.id === id);
    fetch(`/api/plugins/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: p.enabled }),
    }).catch(() => {});
  };

  if (loading) return <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Plugins")}</h1>
          <p className="text-sm text-text-muted mt-1">{translate("Extend NovaRoute with plugins")}</p>
        </div>
        <Link href="/dashboard/marketplace">
          <Button variant="primary">+ {translate("Install Plugin")}</Button>
        </Link>
      </div>

      {plugins.length === 0 ? (
        <Card className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">extension</span>
          <p className="text-sm text-text-muted">{translate("No plugins installed. Browse the marketplace to add functionality.")}</p>
          <Link href="/dashboard/marketplace">
            <Button size="sm" className="mt-4">{translate("Browse Marketplace")}</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plugins.map((p) => (
            <Card key={p.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-text-main text-sm">{p.name}</span>
                <Badge variant={p.enabled ? "success" : "default"} size="sm">{p.version || "1.0"}</Badge>
              </div>
              <p className="text-xs text-text-muted mb-3">{p.description || "—"}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {(p.tags || []).map((t) => <Badge key={t} size="sm" variant="default">{t}</Badge>)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{p.author || "—"}</span>
                <Toggle checked={p.enabled ?? false} onChange={() => togglePlugin(p.id)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
