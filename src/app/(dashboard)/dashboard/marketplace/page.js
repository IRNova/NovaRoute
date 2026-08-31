"use client";

import { useState, useEffect, useCallback } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import { translate } from "@/i18n/runtime";
import { useNotificationStore } from "@/store/notificationStore";

export default function MarketplacePage() {
  const notify = useNotificationStore();
  const [plugins, setPlugins] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async (opts = {}) => {
      const q = opts.query ?? query;
      const t = opts.tab ?? tab;
      setLoading(true);
      try {
        const url = t === "installed" ? "/api/marketplace?action=installed" : `/api/marketplace?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const d = await res.json();
        setPlugins(Array.isArray(d?.plugins) ? d.plugins : []);
        setTotal(typeof d?.total === "number" ? d.total : d?.plugins?.length || 0);
      } catch {
        notify.error(translate("Failed to load marketplace"));
      } finally {
        setLoading(false);
      }
    },
    [query, tab, notify]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const act = async (pluginId, method) => {
    setBusyId(pluginId);
    try {
      const url =
        method === "DELETE"
          ? `/api/marketplace?pluginId=${encodeURIComponent(pluginId)}`
          : "/api/marketplace";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify({ action: method === "DELETE" ? "uninstall" : "install", pluginId }),
      });
      const d = await res.json();
      if (!res.ok || d.success === false) throw new Error(d.error || translate("Action failed"));
      notify.success(method === "DELETE" ? translate("Plugin removed") : translate("Plugin installed"));
      await load();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Marketplace")}</h1>
          <p className="text-sm text-text-muted mt-1">{translate("Discover and install gateway plugins")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${tab === "all" ? "bg-primary/10 text-primary border-primary/30" : "bg-surface-3/50 text-text-muted border-border-subtle"}`}
          >
            {translate("All")}
          </button>
          <button
            type="button"
            onClick={() => setTab("installed")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${tab === "installed" ? "bg-primary/10 text-primary border-primary/30" : "bg-surface-3/50 text-text-muted border-border-subtle"}`}
          >
            {translate("Installed")}
          </button>
        </div>
      </div>

      {tab === "all" && (
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={translate("Search plugins...")}
            onKeyDown={(e) => e.key === "Enter" && load({ query })}
            className="max-w-md"
          />
          <Button variant="primary" onClick={() => load({ query })}>
            {translate("Search")}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : plugins.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-text-muted">
            {tab === "installed" ? translate("No plugins installed yet.") : translate("No plugins found.")}
          </p>
        </Card>
      ) : (
        <>
          <p className="text-xs text-text-muted uppercase tracking-wide">
            {total} {translate("plugin(s)")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plugins.map((p) => {
              const id = p.id || p.pluginId || p.name;
              return (
                <Card key={id} padding="md">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-text-main truncate">{p.name || id}</p>
                    {typeof p.downloads === "number" ? (
                      <span className="text-xs text-text-muted whitespace-nowrap" dir="ltr">{p.downloads.toLocaleString()} ↓</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-text-muted line-clamp-3 min-h-[3rem]">{p.description || p.summary || "—"}</p>
                  <div className="mt-3">
                    {p.installed ? (
                      <Button variant="secondary" fullWidth disabled={busyId === id} onClick={() => act(id, "DELETE")}>
                        {translate("Remove")}
                      </Button>
                    ) : (
                      <Button variant="primary" fullWidth disabled={busyId === id} onClick={() => act(id, "POST")}>
                        {translate("Install")}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
