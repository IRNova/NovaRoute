"use client";

import { cn } from "@/shared/utils/cn";

// Nova's primary CTA is the signature 3-stop gradient carrying dark ink
// (--on-accent), lifted by --shadow-accent. Everything else routes through the
// semantic tokens so the variants follow the theme instead of pinning raw
// palette values.
const variants = {
  primary: cn(
    "bg-[image:var(--grad)] text-[color:var(--on-accent)] shadow-[var(--shadow-accent)]",
    "hover:brightness-[1.06]",
    "disabled:bg-none disabled:bg-surface-3 disabled:text-text-muted disabled:shadow-none"
  ),
  secondary:
    "bg-surface-2 hover:bg-surface-3 text-text-main border border-border disabled:opacity-50",
  outline:
    "border border-border text-text-main hover:bg-surface-2 hover:border-brand-500/40",
  ghost: "text-text-muted hover:bg-surface-2 hover:text-text-main",
  danger: cn(
    "bg-[color:var(--danger-strong)] text-white shadow-sm hover:brightness-[1.08]",
    "disabled:bg-surface-3 disabled:text-text-muted disabled:shadow-none"
  ),
  success: cn(
    "bg-[color:var(--success-strong)] text-white shadow-sm hover:brightness-[1.08]",
    "disabled:bg-surface-3 disabled:text-text-muted disabled:shadow-none"
  ),
};

const sizes = {
  sm: "h-8 px-3 text-xs rounded-[8px]",
  md: "h-9 px-4 text-sm rounded-brand",
  lg: "h-11 px-6 text-sm rounded-brand",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold cursor-pointer",
        "transition-[filter,background-color,border-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          className="material-symbols-outlined animate-spin text-[18px]"
          aria-hidden="true"
        >
          progress_activity
        </span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}
