"use client";

import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";

// Cycles dark -> light -> system so a stored "system" preference stays
// reachable instead of being silently overwritten on the first click.
const MODES = {
  dark: { icon: "dark_mode", label: "Dark theme, switch to light" },
  light: { icon: "light_mode", label: "Light theme, switch to system" },
  system: { icon: "contrast", label: "System theme, switch to dark" },
};

export default function ThemeToggle({ className, variant = "default" }) {
  const { theme, cycleTheme } = useTheme();
  const mode = MODES[theme] || MODES.dark;

  const variants = {
    default: cn(
      "flex items-center justify-center size-10 rounded-full",
      "text-text-muted hover:text-text-main",
      "hover:bg-surface-2 transition-colors"
    ),
    card: cn(
      "flex items-center justify-center size-11 rounded-full",
      "bg-surface/60 hover:bg-surface",
      "border border-border",
      "backdrop-blur-md shadow-sm hover:shadow-[var(--shadow-warm)]",
      "text-text-muted hover:text-brand-500",
      "transition-all group"
    ),
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={cn(variants[variant], className)}
      aria-label={mode.label}
      title={mode.label}
    >
      <span
        className={cn(
          "material-symbols-outlined text-[22px]",
          variant === "card" && "transition-transform duration-300 group-hover:rotate-12"
        )}
      >
        {mode.icon}
      </span>
    </button>
  );
}
