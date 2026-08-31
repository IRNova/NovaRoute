"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Tooltip from "@/shared/components/Tooltip";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { translate } from "@/i18n/runtime";
import { cn } from "@/shared/utils/cn";

const SORT_OPTIONS = [
  { value: "usage-desc", label: "Highest Usage" },
  { value: "usage-asc", label: "Lowest Usage" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "limit-desc", label: "Largest Limit" },
  { value: "limit-asc", label: "Smallest Limit" },
  { value: "requests-desc", label: "Most Requests" },
];

function formatTokenCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n) {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

function getCountdown(resetTime) {
  if (!resetTime) return null;
  const diff = new Date(resetTime).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function UsageBar({ percentage }) {
  const getColor = (pct) => {
    if (pct >= 90) return { bar: "bg-red-500", bg: "bg-red-500/10", text: "text-red-500" };
    if (pct >= 70) return { bar: "bg-amber-500", bg: "bg-amber-500/10", text: "text-amber-500" };
    if (pct >= 40) return { bar: "bg-blue-500", bg: "bg-blue-500/10", text: "text-blue-500" };
    return { bar: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-500" };
  };

  const colors = getColor(percentage);

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className={cn("flex-1 h-2 rounded-full overflow-hidden", colors.bg)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className={cn("text-xs font-semibold tabular-nums w-9 text-right", colors.text)}>
        {percentage}%
      </span>
    </div>
  );
}

function ModelRow({ entry, isExpanded, onToggle }) {
  return (
    <div
      className={cn(
        "group border-b border-border-subtle last:border-b-0 transition-colors",
        "hover:bg-surface-2/40",
        isExpanded && "bg-surface-2/30"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center overflow-hidden">
          <ProviderIcon
            src={`/providers/${entry.provider}.png`}
            alt={entry.provider}
            size={28}
            className="object-contain"
            fallbackText={entry.provider?.slice(0, 2).toUpperCase() || "?"}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-main truncate">
              {entry.model}
            </span>
            <Badge variant="default" size="sm">
              {entry.provider}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-text-muted">
              {translate("Limit")}: {formatTokenCount(entry.tokenLimit)}
            </span>
            <span className="text-xs text-text-muted">
              {formatTokenCount(entry.tokensUsed)} {translate("used")}
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <div className="text-right min-w-[80px]">
            <p className="text-xs text-text-muted">{translate("Requests")}</p>
            <p className="text-sm font-semibold text-text-main tabular-nums">
              {entry.requests.toLocaleString()}
            </p>
          </div>
          <div className="text-right min-w-[60px]">
            <p className="text-xs text-text-muted">{translate("Cost")}</p>
            <p className="text-sm font-semibold text-text-main tabular-nums">
              {formatCost(entry.cost)}
            </p>
          </div>
        </div>

        <UsageBar percentage={entry.usagePercentage} />

        <span className="material-symbols-outlined text-[18px] text-text-muted transition-transform duration-200 shrink-0" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          expand_more
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-bg border border-border-subtle">
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider">{translate("Token Limit")}</p>
              <p className="text-sm font-semibold text-text-main mt-0.5">
                {entry.tokenLimit.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider">{translate("Tokens Used")}</p>
              <p className="text-sm font-semibold text-text-main mt-0.5">
                {entry.tokensUsed.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider">{translate("Prompt Tokens")}</p>
              <p className="text-sm font-semibold text-text-main mt-0.5">
                {entry.promptTokens.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider">{translate("Completion Tokens")}</p>
              <p className="text-sm font-semibold text-text-main mt-0.5">
                {entry.completionTokens.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider">{translate("Remaining")}</p>
              <p className={cn(
                "text-sm font-semibold mt-0.5",
                entry.remaining === 0 ? "text-red-500" : "text-emerald-500"
              )}>
                {entry.remaining.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider">{translate("Requests")}</p>
              <p className="text-sm font-semibold text-text-main mt-0.5">
                {entry.requests.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider">{translate("Cost")}</p>
              <p className="text-sm font-semibold text-text-main mt-0.5">
                {formatCost(entry.cost)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider">{translate("Usage")}</p>
              <p className="text-sm font-semibold text-text-main mt-0.5">
                {entry.usagePercentage}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModelTokenTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [providerFilter, setProviderFilter] = useState("all");
  const [sortBy, setSortBy] = useState("usage-desc");
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/model-tokens", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch model token data");
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("[ModelTokenTracker] Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data?.nextReset) return;
    setCountdown(getCountdown(data.nextReset));

    countdownRef.current = setInterval(() => {
      setCountdown(getCountdown(data.nextReset));
    }, 60000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [data?.nextReset]);

  const providers = useMemo(() => {
    if (!data?.models) return [];
    const set = new Set(data.models.map((m) => m.provider));
    return Array.from(set).sort();
  }, [data?.models]);

  const filteredModels = useMemo(() => {
    if (!data?.models) return [];
    let list = data.models;

    if (providerFilter !== "all") {
      list = list.filter((m) => m.provider === providerFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.model.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    switch (sortBy) {
      case "usage-desc":
        sorted.sort((a, b) => b.usagePercentage - a.usagePercentage);
        break;
      case "usage-asc":
        sorted.sort((a, b) => a.usagePercentage - b.usagePercentage);
        break;
      case "name-asc":
        sorted.sort((a, b) => a.model.localeCompare(b.model));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.model.localeCompare(a.model));
        break;
      case "limit-desc":
        sorted.sort((a, b) => b.tokenLimit - a.tokenLimit);
        break;
      case "limit-asc":
        sorted.sort((a, b) => a.tokenLimit - b.tokenLimit);
        break;
      case "requests-desc":
        sorted.sort((a, b) => b.requests - a.requests);
        break;
      default:
        break;
    }

    return sorted;
  }, [data?.models, providerFilter, sortBy, searchQuery]);

  const toggleRow = useCallback((key) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const summary = useMemo(() => {
    if (!data?.models?.length) return null;
    const total = data.models.length;
    const totalTokensUsed = data.models.reduce((s, m) => s + m.tokensUsed, 0);
    const totalRequests = data.models.reduce((s, m) => s + m.requests, 0);
    const totalCost = data.models.reduce((s, m) => s + m.cost, 0);
    const highUsage = data.models.filter((m) => m.usagePercentage >= 70).length;
    return { total, totalTokensUsed, totalRequests, totalCost, highUsage };
  }, [data?.models]);

  if (loading) {
    return (
      <Card icon="token" title={translate("Model Token Tracker")} padding="md">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-7 h-7 rounded-md bg-surface-3" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-3 rounded w-1/3" />
                <div className="h-3 bg-surface-3 rounded w-1/4" />
              </div>
              <div className="h-2 bg-surface-3 rounded w-24" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card icon="token" title={translate("Model Token Tracker")} padding="md">
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-[40px] text-danger/40">error</span>
          <p className="mt-2 text-sm text-text-muted">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 text-xs text-primary hover:underline"
          >
            {translate("Retry")}
          </button>
        </div>
      </Card>
    );
  }

  if (!data?.models?.length) {
    return (
      <Card icon="token" title={translate("Model Token Tracker")} padding="md">
        <div className="text-center py-10">
          <span className="material-symbols-outlined text-[56px] text-text-muted/20">token</span>
          <h3 className="mt-3 text-base font-semibold text-text-main">
            {translate("No Models Tracked")}
          </h3>
          <p className="mt-1.5 text-sm text-text-muted max-w-sm mx-auto">
            {translate("Models will appear here after providers are connected and requests are made.")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      icon="token"
      title={translate("Model Token Tracker")}
      subtitle={
        summary
          ? `${summary.total} ${translate("models")} · ${formatTokenCount(summary.totalTokensUsed)} ${translate("tokens today")}`
          : undefined
      }
      action={
        <div className="flex items-center gap-2">
          {countdown && (
            <Tooltip text={translate("Time until daily reset")}>
              <Badge variant="info" size="sm" icon="schedule">
                {countdown}
              </Badge>
            </Tooltip>
          )}
          <button
            onClick={fetchData}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-primary"
            title={translate("Refresh")}
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
        </div>
      }
      padding="none"
    >
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-b border-border-subtle bg-bg/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary/60">model_training</span>
            <div>
              <p className="text-[11px] text-text-muted">{translate("Models")}</p>
              <p className="text-sm font-semibold text-text-main">{summary.total}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-info/60">data_usage</span>
            <div>
              <p className="text-[11px] text-text-muted">{translate("Tokens Used")}</p>
              <p className="text-sm font-semibold text-text-main">{formatTokenCount(summary.totalTokensUsed)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-success/60">send</span>
            <div>
              <p className="text-[11px] text-text-muted">{translate("Requests")}</p>
              <p className="text-sm font-semibold text-text-main">{summary.totalRequests.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-warning/60">warning</span>
            <div>
              <p className="text-[11px] text-text-muted">{translate("High Usage")}</p>
              <p className="text-sm font-semibold text-text-main">{summary.highUsage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <input
          type="search"
          placeholder={translate("Search models...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-7 w-40 rounded-lg border border-border bg-surface-2/40 px-2 text-xs text-text-main outline-none transition-colors placeholder:text-text-muted hover:bg-surface-2 focus:border-primary/50"
        />

        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setProviderFilter("all")}
            className={cn(
              "h-7 rounded-lg px-2 text-xs font-medium transition-colors",
              providerFilter === "all"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "border border-border text-text-muted hover:bg-surface-2 hover:text-text-main"
            )}
          >
            {translate("All")}
          </button>
          {providers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProviderFilter(p)}
              className={cn(
                "flex items-center gap-1 h-7 rounded-lg px-2 text-xs font-medium transition-colors capitalize",
                providerFilter === p
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "border border-border text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
            >
              <ProviderIcon
                src={`/providers/${p}.png`}
                alt={p}
                size={14}
                className="rounded object-contain"
                fallbackText={p.slice(0, 1).toUpperCase()}
              />
              {p}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-7 rounded-lg border border-border bg-surface-2/40 px-2 text-xs text-text-main outline-none transition-colors hover:bg-surface-2 ml-auto"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {translate(opt.label)}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {filteredModels.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-[36px] text-text-muted/20">search_off</span>
            <p className="mt-2 text-sm text-text-muted">
              {translate("No models match your filters")}
            </p>
          </div>
        ) : (
          filteredModels.map((entry) => {
            const key = `${entry.provider}/${entry.model}`;
            return (
              <ModelRow
                key={key}
                entry={entry}
                isExpanded={expandedRows.has(key)}
                onToggle={() => toggleRow(key)}
              />
            );
          })
        )}
      </div>
    </Card>
  );
}
