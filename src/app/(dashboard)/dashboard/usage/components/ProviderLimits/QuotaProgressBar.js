"use client";

import { cn } from "@/shared/utils/cn";
import { formatResetTime } from "./utils";

const getColorClasses = (remainingPercentage) => {
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
};

const formatResetTimeDisplay = (resetTime) => {
  if (!resetTime) return null;

  try {
    const resetDate = new Date(resetTime);
    const now = new Date();
    const isToday = resetDate.toDateString() === now.toDateString();
    const isTomorrow = resetDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    const timeStr = resetDate.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;

    return resetDate.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
};

export default function QuotaProgressBar({
  percentage = 0,
  label = "",
  used = 0,
  total = 0,
  unlimited = false,
  resetTime = null,
  recurring = true,
}) {
  const colors = getColorClasses(percentage);
  const countdown = formatResetTime(resetTime);
  const resetDisplay = formatResetTimeDisplay(resetTime);
  const resetWord = recurring ? "Reset" : "Expires";
  const remaining = percentage;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", colors.dot)} />
          <span className="font-semibold text-text-main">{label}</span>
        </div>
        <span className={cn("font-medium", colors.text)}>{remaining}%</span>
      </div>

      {!unlimited && (
        <div className="h-2 rounded-full overflow-hidden bg-surface-2">
          <div
            className={cn("h-full transition-all duration-300", colors.bg)}
            style={{ width: `${Math.min(remaining, 100)}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{used.toLocaleString()} / {total.toLocaleString()} requests</span>
        {countdown !== "-" && (
          <div className="flex items-center gap-1">
            <span>•</span>
            <span className="font-medium">{resetWord} in {countdown}</span>
          </div>
        )}
      </div>

      {resetDisplay && (
        <div className="text-xs text-text-muted/70">
          {resetWord} at {resetDisplay}
        </div>
      )}
    </div>
  );
}
