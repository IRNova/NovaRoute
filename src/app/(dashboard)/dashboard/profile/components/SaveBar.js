"use client";

import Button from "@/shared/components/Button";
import { cn } from "@/shared/utils/cn";
import { translate } from "@/i18n/runtime";

export default function SaveBar({
  onSave,
  saving = false,
  status,
  disabled = false,
  saveLabel = "Save",
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-border/50",
        className,
      )}
    >
      <Button
        variant="primary"
        onClick={onSave}
        loading={saving}
        disabled={disabled}
        className="w-full sm:w-auto"
      >
        {saving ? translate("Saving...") : translate(saveLabel)}
      </Button>
      {status?.message && (
        <p
          className={cn(
            "text-xs sm:text-sm",
            status.type === "error" ? "text-danger" : "text-success",
          )}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
