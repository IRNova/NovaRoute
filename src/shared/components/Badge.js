"use client";

import { cn } from "@/shared/utils/cn";

// Routed through the semantic tokens rather than raw palette steps, so the
// badges track the theme instead of needing a light/dark pair each.
const variants = {
  default: "bg-surface-2 text-text-muted",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
};

const dots = {
  default: "bg-text-subtle",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
  info: "bg-info",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn("size-1.5 rounded-full", dots[variant] || dots.default)}
          aria-hidden="true"
        />
      )}
      {icon && (
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
