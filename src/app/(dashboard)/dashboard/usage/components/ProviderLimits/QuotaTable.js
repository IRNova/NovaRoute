"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { formatResetTime, getRemainingPercentage } from "./utils";

const PAGE_SIZE = 10;

function formatResetTimeDisplay(resetTime) {
  if (!resetTime) return null;

  try {
    const date = new Date(resetTime);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayStr = "";
    if (date >= today && date < tomorrow) {
      dayStr = "Today";
    } else if (date >= tomorrow && date < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
      dayStr = "Tomorrow";
    } else {
      dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${dayStr}, ${timeStr}`;
  } catch {
    return null;
  }
}

function getColorClasses(remainingPercentage) {
  if (remainingPercentage > 70) {
    return {
      text: "text-green-600 dark:text-green-400",
      bg: "bg-green-500",
      bgLight: "bg-green-500/10",
      dot: "bg-green-500",
    };
  }

  if (remainingPercentage >= 30) {
    return {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500",
      bgLight: "bg-amber-500/10",
      dot: "bg-amber-500",
    };
  }

  return {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-500",
    bgLight: "bg-red-500/10",
    dot: "bg-red-500",
  };
}

function sortQuotas(quotas, sortMode) {
  if (sortMode === "remaining-asc") {
    return [...quotas].sort((a, b) => a.remaining - b.remaining || a.name.localeCompare(b.name));
  }

  if (sortMode === "remaining-desc") {
    return [...quotas].sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name));
  }

  return quotas;
}

export default function QuotaTable({
  quotas = [],
  compact = false,
  sortMode = "default",
  showSortLabel = false,
  onHideQuota = null,
}) {
  const [page, setPage] = useState(1);

  const normalizedQuotas = useMemo(
    () => quotas.map((quota, index) => ({
      ...quota,
      index,
      remaining: getRemainingPercentage(quota),
    })),
    [quotas],
  );

  const sortedQuotas = useMemo(
    () => sortQuotas(normalizedQuotas, sortMode),
    [normalizedQuotas, sortMode],
  );

  const totalPages = Math.max(1, Math.ceil(sortedQuotas.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [sortMode, quotas]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  if (!quotas || quotas.length === 0) {
    return null;
  }

  const currentPageRows = sortedQuotas.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const pageStart = sortedQuotas.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, sortedQuotas.length);

  const hasHideAction = typeof onHideQuota === "function";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-text-muted">
          {sortedQuotas.length} quota{sortedQuotas.length > 1 ? "s" : ""}
        </div>
        {showSortLabel && (
          <div className="rounded-lg border border-border bg-surface-2/50 px-2 py-1 text-[10px] text-text-muted">
            Sorted by account remaining
          </div>
        )}
      </div>

      <div className="space-y-1">
        {currentPageRows.map((quota) => {
          const colors = getColorClasses(quota.remaining);
          const countdown = formatResetTime(quota.resetAt);
          const resetDisplay = formatResetTimeDisplay(quota.resetAt);
          const recurring = quota.recurring !== false;
          const countdownLabel = recurring ? `in ${countdown}` : `expires in ${countdown}`;

          return (
            <div
              key={`${quota.name}-${quota.index}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 hover:border-primary/20 transition-colors"
            >
              {/* Status dot + Name */}
              <div className="flex w-32 min-w-0 items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", colors.dot)} />
                <span className="text-xs font-medium text-text-main truncate">
                  {quota.name}
                </span>
              </div>

              {/* Progress */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-1.5 rounded-full overflow-hidden bg-surface-2">
                  <div
                    className={cn("h-full transition-all duration-300", colors.bg)}
                    style={{ width: `${Math.min(quota.remaining, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-1 text-[10px] text-text-muted">
                  <span
                    className="truncate"
                    title={`${quota.used.toLocaleString()} / ${quota.total > 0 ? quota.total.toLocaleString() : "∞"}`}
                  >
                    {quota.used.toLocaleString()} / {quota.total > 0 ? quota.total.toLocaleString() : "∞"}
                  </span>
                  <span className={cn("font-medium", colors.text)}>{quota.remaining}%</span>
                </div>
              </div>

              {/* Reset time */}
              <div className="min-w-0 shrink text-right">
                {countdown !== "-" || resetDisplay ? (
                  <div className="text-xs text-text-main font-medium truncate" title={resetDisplay || ""}>
                    {countdown !== "-" ? countdownLabel : resetDisplay}
                  </div>
                ) : (
                  <div className="text-xs text-text-muted italic">N/A</div>
                )}
              </div>

              {/* Hide action */}
              {hasHideAction && (
                <button
                  type="button"
                  onClick={() => onHideQuota(quota)}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
                  title="Hide this quota row"
                  aria-label={`Hide quota ${quota.name}`}
                >
                  <span className="material-symbols-outlined text-[15px]">visibility_off</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="rounded-xl border border-border bg-surface px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
            <span>Showing {pageStart}-{pageEnd} of {sortedQuotas.length}</span>
            <span>Page {page} / {totalPages}</span>
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page === 1}
              className="flex h-7 items-center rounded-lg border border-border px-2 text-[10px] text-text-main transition-colors hover:bg-surface-2 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={page === totalPages}
              className="flex h-7 items-center rounded-lg border border-border px-2 text-[10px] text-text-main transition-colors hover:bg-surface-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
