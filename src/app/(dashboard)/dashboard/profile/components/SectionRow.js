"use client";

import Toggle from "@/shared/components/Toggle";
import { cn } from "@/shared/utils/cn";

export default function SectionRow({
  title,
  description,
  checked,
  onChange,
  disabled = false,
  children,
  className,
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm sm:text-base">{title}</p>
          {description && (
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
              {description}
            </p>
          )}
        </div>
        <Toggle
          aria-label={title}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
      {children && (
        <div className="pt-3 border-t border-border/50">{children}</div>
      )}
    </div>
  );
}
