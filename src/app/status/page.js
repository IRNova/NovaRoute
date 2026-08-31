"use client";

import { useState, useEffect } from "react";

export default function PublicStatusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/public-status")
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then(setData)
        .catch(() => setError(true));
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const fmtUptime = (s) =>
    s == null ? "—" : `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface shadow-[var(--shadow-soft)] p-8 text-center">
        <img src="/logo-mark.svg" alt="NovaRoute" className="size-14 mx-auto mb-4 object-contain" />
        <h1 className="text-xl font-bold text-text-main mb-1">NovaRoute Status</h1>
        {error ? (
          <p className="text-sm text-danger mt-4">Status unavailable</p>
        ) : !data ? (
          <p className="text-sm text-text-muted mt-4">Loading…</p>
        ) : (
          <>
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success font-semibold">
              <span className="size-2.5 rounded-full bg-success animate-pulse" />
              All systems operational
            </div>
            <dl className="mt-6 space-y-2 text-sm text-left" dir="ltr">
              <div className="flex justify-between py-1.5 border-b border-border-subtle/60">
                <dt className="text-text-muted">Uptime (this boot)</dt>
                <dd className="font-medium text-text-main">{fmtUptime(data.uptimeSeconds)}</dd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border-subtle/60">
                <dt className="text-text-muted">Active connections</dt>
                <dd className="font-medium text-text-main">{data.activeConnections ?? "—"}</dd>
              </div>
              <div className="flex justify-between py-1.5">
                <dt className="text-text-muted">Models available</dt>
                <dd className="font-medium text-text-main">{data.modelsAvailable ?? "—"}</dd>
              </div>
            </dl>
            <p className="text-[11px] text-text-muted mt-6">Auto-refreshes every 30 seconds</p>
          </>
        )}
      </div>
    </div>
  );
}
