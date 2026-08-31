"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card, { CardSkeleton } from "@/shared/components/Card";
import { translate } from "@/i18n/runtime";

// Compression analytics — REAL accounting from the Token Saver (RTK) ledger
// (/api/rtk/stats). Every compressed request is recorded with before/after size.
export default function CompressionPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rtk/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const all = stats?.allTime || { requests: 0, compressedRequests: 0, charsSaved: 0, savedPct: 0, tokensSavedEst: 0, usdSavedEst: 0 };
  const hasData = all.requests > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">{translate("Compression")}</h1>
        <p className="text-sm text-text-muted mt-1">
          {translate("Real compression accounting from the Token Saver ledger")}
        </p>
      </div>

      {!hasData ? (
        <Card padding="md">
          <p className="text-sm text-text-muted">
            {translate("No compressed traffic yet — enable the Token Saver and route requests to populate this page.")}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { l: translate("Requests"), v: (all.requests || 0).toLocaleString() },
              { l: translate("Chars saved"), v: (all.charsSaved || 0).toLocaleString() },
              { l: translate("Compression ratio"), v: `${all.savedPct || 0}%` },
              { l: translate("Estimated saving"), v: `$${(all.usdSavedEst || 0).toFixed(2)}` },
            ].map((t) => (
              <Card key={t.l} padding="md">
                <p className="text-xs text-text-muted uppercase tracking-wide">{t.l}</p>
                <p className="text-2xl font-bold text-text-main mt-1" dir="ltr">{t.v}</p>
              </Card>
            ))}
          </div>

          <Card title={translate("Saved per day")} subtitle={translate("Estimated tokens saved (≈4 chars/token)")}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.daily || []}>
                  <defs>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="tokensSavedEst" stroke="#10b981" fill="url(#compGrad)" strokeWidth={2} name={translate("Tokens saved")} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={translate("By provider")} subtitle={translate("Where compression happens most")}>
            {(stats?.providers || []).length === 0 ? (
              <p className="text-sm text-text-muted">{translate("No usage data yet.")}</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.providers.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="provider" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="charsSaved" fill="#10b981" radius={[0, 6, 6, 0]} name={translate("Chars saved")} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
