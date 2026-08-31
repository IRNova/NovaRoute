"use client";

import { useState, useEffect } from "react";
import { translate } from "@/i18n/runtime";

// One-click system health report (mirrors the nova-doctor CLI checks that can
// run in-process: service, memory, providers, pools, backup freshness, logs).
export default function SystemHealthModal({ onClose }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/system/health-report")
      .then((r) => r.json())
      .then(setReport)
      .catch(() => setError(true));
  }, []);

  const statusColor = (s) =>
    s === "healthy" ? "text-success bg-success/10" : s === "degraded" ? "text-warning bg-warning/10" : "text-text-muted bg-surface-3";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border-subtle bg-elevated shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-main">{translate("System Health")}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface-3 text-text-muted">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error ? (
          <p className="text-sm text-danger">{translate("Failed to load monitoring data")}</p>
        ) : !report ? (
          <p className="text-sm text-text-muted">{translate("Loading")}…</p>
        ) : (
          <>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4 ${statusColor(report.status).split(" ")[1]} ${statusColor(report.status).split(" ")[0]}`}>
              {report.status === "healthy" ? "✓ ALL CHECKS PASSED" : report.status.toUpperCase()}
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(report.checks || []).map((c) => (
                <div key={c.name} className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-surface-3/50 border border-border-subtle">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main">{c.name}</p>
                    {c.detail && <p className="text-xs text-text-muted break-words" dir="ltr">{c.detail}</p>}
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${c.status === "healthy" ? "bg-success/15 text-success" : c.status === "degraded" ? "bg-warning/15 text-warning" : ""}`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-3" dir="ltr">
              free mem: {report.systemFreeMemMB} MB · {new Date(report.generatedAt).toLocaleTimeString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
