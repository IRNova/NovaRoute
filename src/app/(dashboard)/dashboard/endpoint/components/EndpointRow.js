"use client";

import { Input } from "@/shared/components";

/** Reusable endpoint row component */
export default function EndpointRow({ label, url, copyId, copied, onCopy, badge, actions }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2 pr-3 transition-colors hover:border-primary/30">
      <span className={`text-xs font-mono px-2.5 py-1.5 rounded-lg shrink-0 min-w-[88px] text-center font-medium ${
          (badge === "CF" || badge === "TS") ? "bg-primary/10 text-primary" : "bg-surface-2 text-text-muted"
        }`}>{label}</span>
      <Input
        value={url}
        readOnly
        aria-label={`${label} endpoint URL`}
        className="flex-1"
        inputClassName="border-0 bg-transparent shadow-none py-1.5 font-mono text-sm focus:ring-0"
      />
      <button
        onClick={() => onCopy(url, copyId)}
        className="flex h-8 w-8 items-center justify-center rounded-brand text-text-muted hover:bg-surface-2 hover:text-primary transition-colors shrink-0"
        title="Copy"
        aria-label={`Copy the ${label} endpoint URL`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{copied === copyId ? "check" : "content_copy"}</span>
      </button>
      {actions}
    </div>
  );
}
