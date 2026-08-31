"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card, { CardSkeleton } from "@/shared/components/Card";
import { translate } from "@/i18n/runtime";

// Per-key usage (7d) — real aggregation from /api/usage/stats byApiKey.
export default function KeyUsageCard() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch("/api/usage/stats?period=7d")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        const grouped = new Map();
        for (const e of Object.values(s?.byApiKey || {})) {
          const name = e.keyName || e.apiKeyMasked || "local-no-key";
          const cur = grouped.get(name) || { name, requests: 0, cost: 0 };
          cur.requests += Number(e.requests) || 0;
          cur.cost += Number(e.cost) || 0;
          grouped.set(name, cur);
        }
        setRows([...grouped.values()].sort((a, b) => b.requests - a.requests).slice(0, 8));
      })
      .catch(() => {});
  }, []);

  if (rows.length === 0) return null;

  return (
    <Card title={translate("Usage per key")} subtitle={translate("Requests in the last 7 days")}>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="requests" fill="var(--color-primary, #7c3aed)" radius={[0, 6, 6, 0]} name={translate("Requests")} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
