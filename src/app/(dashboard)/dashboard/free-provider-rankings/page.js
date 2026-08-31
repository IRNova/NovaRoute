"use client";

import { useState, useEffect, useMemo } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Select from "@/shared/components/Select";

const FALLBACK_PROVIDERS = [
  { rank: 1, provider: "Google AI Studio", models: 15, rateLimit: "15 RPM / 1M TPD", qualityScore: 92, color: "#4285F4" },
  { rank: 2, provider: "Groq", models: 12, rateLimit: "30 RPM / 14,400 PD", qualityScore: 89, color: "#F55036" },
  { rank: 3, provider: "Cerebras", models: 8, rateLimit: "30 RPM / 1M TPD", qualityScore: 85, color: "#7C3AED" },
  { rank: 4, provider: "SambaNova", models: 6, rateLimit: "10 RPM / 500K TPD", qualityScore: 83, color: "#0EA5E9" },
  { rank: 5, provider: "Together AI", models: 10, rateLimit: "60 RPM / 10K credits", qualityScore: 80, color: "#10B981" },
  { rank: 6, provider: "Mistral", models: 5, rateLimit: "1 RPM / 50 RPD", qualityScore: 78, color: "#FF7000" },
  { rank: 7, provider: "Cloudflare Workers AI", models: 20, rateLimit: "10K RPD free", qualityScore: 74, color: "#F38020" },
  { rank: 8, provider: "DeepSeek", models: 4, rateLimit: "10 RPM / 1M TPD", qualityScore: 88, color: "#4F46E5" },
  { rank: 9, provider: "Hugging Face", models: 30, rateLimit: "300 RPD / 30 RPM", qualityScore: 70, color: "#FFD21E" },
  { rank: 10, provider: "Novita AI", models: 7, rateLimit: "20 RPM / 500K TPD", qualityScore: 76, color: "#8B5CF6" },
];

const SORT_OPTIONS = [
  { value: "qualityScore", label: "Quality Score" },
  { value: "rateLimit", label: "Rate Limit" },
  { value: "models", label: "Model Count" },
];

function scoreBadgeVariant(score) {
  if (score >= 85) return "success";
  if (score >= 75) return "warning";
  return "default";
}

function rankBadgeVariant(rank) {
  if (rank === 1) return "warning";
  if (rank === 2) return "info";
  if (rank === 3) return "success";
  return "default";
}

function parseRateLimitForSort(rl) {
  if (!rl) return 0;
  const match = rl.match(/(\d+[\d,]*)\s*RPM/i);
  if (match) return parseInt(match[1].replace(/,/g, ""), 10);
  const tpd = rl.match(/(\d+[\d,]*)\s*(?:TPD|RPD|credits)/i);
  if (tpd) return Math.floor(parseInt(tpd[1].replace(/,/g, ""), 10) / 100);
  return 0;
}

export default function FreeProviderRankingsPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("qualityScore");

  useEffect(() => {
    fetch("/api/free-provider-rankings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setProviders(d?.providers || FALLBACK_PROVIDERS);
        setLoading(false);
      })
      .catch(() => {
        setProviders(FALLBACK_PROVIDERS);
        setLoading(false);
      });
  }, []);

  const sorted = useMemo(() => {
    const list = [...providers];
    if (sortBy === "models") {
      list.sort((a, b) => b.models - a.models);
    } else if (sortBy === "rateLimit") {
      list.sort((a, b) => parseRateLimitForSort(b.rateLimit) - parseRateLimitForSort(a.rateLimit));
    } else {
      list.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    }
    return list.map((p, i) => ({ ...p, rank: i + 1 }));
  }, [providers, sortBy]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Free Provider Rankings</h1>
          <p className="text-sm text-text-muted mt-1">Ranked list of free-tier AI providers</p>
        </div>
        <Select
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <span className="material-symbols-outlined text-[28px] text-success">emoji_events</span>
          <p className="text-2xl font-bold text-text-main mt-1">{sorted.length}</p>
          <p className="text-xs text-text-muted">Free Providers</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="material-symbols-outlined text-[28px] text-info">smart_toy</span>
          <p className="text-2xl font-bold text-text-main mt-1">{sorted.reduce((s, p) => s + p.models, 0)}</p>
          <p className="text-xs text-text-muted">Total Free Models</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="material-symbols-outlined text-[28px] text-warning">star</span>
          <p className="text-2xl font-bold text-text-main mt-1">
            {sorted.length > 0 ? (sorted.reduce((s, p) => s + p.qualityScore, 0) / sorted.length).toFixed(0) : 0}
          </p>
          <p className="text-xs text-text-muted">Avg Quality Score</p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-text-muted text-xs uppercase">
            <tr>
              <th className="p-3 text-center w-16">Rank</th>
              <th className="p-3 text-left">Provider</th>
              <th className="p-3 text-center">Models</th>
              <th className="p-3 text-left">Rate Limit</th>
              <th className="p-3 text-center">Quality Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3/50">
            {sorted.map((p) => (
              <tr key={p.provider} className="hover:bg-surface-2/50 transition-colors">
                <td className="p-3 text-center">
                  <Badge variant={rankBadgeVariant(p.rank)} size="sm">#{p.rank}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: p.color || "#6B7280" }}
                    >
                      {p.provider.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-text-main">{p.provider}</span>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <span className="text-text-main font-medium">{p.models}</span>
                </td>
                <td className="p-3">
                  <span className="text-xs text-text-muted">{p.rateLimit}</span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16 h-2 overflow-hidden rounded-full bg-bg-subtle">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${p.qualityScore}%` }}
                      />
                    </div>
                    <Badge variant={scoreBadgeVariant(p.qualityScore)} size="sm">
                      {p.qualityScore}
                    </Badge>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">No free providers available</div>
        )}
      </Card>
    </div>
  );
}
