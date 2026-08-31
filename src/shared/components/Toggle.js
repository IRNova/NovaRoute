"use client";

import { useId } from "react";
import { cn } from "@/shared/utils/cn";

export default function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className,
  "aria-label": ariaLabel,
}) {
  const sizes = {
    sm: { track: "w-8 h-4", thumb: "size-3" },
    md: { track: "w-11 h-6", thumb: "size-5" },
    lg: { track: "w-14 h-7", thumb: "size-6" },
  };

  // The switch had no accessible name when rendered without a `label`, which
  // is how most call sites use it. Point it at the visible label when there is
  // one, and fall back to an explicit aria-label.
  const labelId = useId();

  const handleClick = () => {
    if (!disabled && onChange) onChange(!checked);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={!label ? ariaLabel : undefined}
        aria-labelledby={label ? labelId : undefined}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer rounded-full",
          "transition-colors duration-200 ease-in-out",
          "focus:outline-none focus:ring-2 focus:ring-success/30",
          checked ? "bg-success" : "bg-surface-3",
          sizes[size].track,
          disabled && "cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute top-0.5 inline-block rounded-full bg-white shadow-sm",
            "transition-all duration-200 ease-in-out",
            checked ? "end-0.5" : "start-0.5",
            sizes[size].thumb
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span id={labelId} className="text-sm font-medium text-text-main">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-text-muted">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
