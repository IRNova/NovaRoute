"use client";

import { useState, useEffect, useMemo } from "react";
import Card from "@/shared/components/Card";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { cn } from "@/shared/utils/cn";

const CAPABILITY_FILTERS = [
  { key: "all", label: "All", icon: "apps" },
  { key: "vision", label: "Vision", icon: "visibility" },
  { key: "pdf", label: "PDF", icon: "description" },
  { key: "audioInput", label: "Audio in", icon: "graphic_eq" },
  { key: "audioOutput", label: "Audio out", icon: "volume_up" },
  { key: "imageOutput", label: "Images", icon: "image" },
  { key: "search", label: "Search", icon: "travel_explore" },
  { key: "tools", label: "Tools", icon: "handyman" },
  { key: "reasoning", label: "Reasoning", icon: "psychology" },
];

const MODEL_COUNT_PREVIEW = 60;

export default function ModelsExplorer() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    let cancelled = false;
    fetch("/v1/models", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("models fetch failed");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setModels(data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const out = { all: models.length };
    for (const f of CAPABILITY_FILTERS) {
      if (f.key !== "all") out[f.key] = 0;
    }
    for (const model of models) {
      const caps = model.capabilities || {};
      for (const f of CAPABILITY_FILTERS) {
        if (f.key !== "all" && caps[f.key]) out[f.key] += 1;
      }
    }
    return out;
  }, [models]);

  const visibleModels =
    filter === "all"
      ? models
      : models.filter((model) => (model.capabilities || {})[filter]);

  const previewModels = showAll
    ? visibleModels
    : visibleModels.slice(0, MODEL_COUNT_PREVIEW);
  const hasMore = visibleModels.length > MODEL_COUNT_PREVIEW;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-primary">
            smart_toy
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Available Models
          </h2>
        </div>
        {!loading && !error && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-muted tabular-nums">
            {models.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-text-muted">
          Every model NovaRoute can route right now, live from the gateway and
          grouped by capability. Paste any model ID into your tools as
          <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-main">
            gpt-4o
          </code>
          or
          <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-main">
            agentrouter/gpt-5.6-sol
          </code>
          .
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-text-muted">
            <span className="material-symbols-outlined animate-spin text-[16px]">
              progress_activity
            </span>
            Loading available models...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-300 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:text-red-400">
            Could not load the model list from the gateway.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {CAPABILITY_FILTERS.map((option) => {
                const active = filter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setFilter(option.key);
                      setShowAll(false);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-text-muted hover:bg-surface-2 hover:text-text-main",
                    )}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {option.icon}
                    </span>
                    <span>{option.label}</span>
                    <span className="text-[10px] tabular-nums opacity-70">
                      {counts[option.key] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {visibleModels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface/70 p-8 text-center">
                <span className="material-symbols-outlined inline-block text-[28px] text-text-muted mb-2">
                  filter_alt_off
                </span>
                <p className="text-sm text-text-muted">
                  No connected model has this capability yet.
                </p>
              </div>
            ) : (
              <div className="flex max-h-[420px] min-w-0 flex-col gap-2 overflow-y-auto pr-1">
                {previewModels.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    copied={copied}
                    onCopy={copy}
                  />
                ))}
              </div>
            )}

            {hasMore && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="self-start rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
              >
                Show all {visibleModels.length} models
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function ModelRow({ model, copied, onCopy }) {
  const caps = model.capabilities || {};
  const copyId = `model-${model.id}`;
  return (
    <div className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2.5 transition-colors hover:border-primary/30">
      <span className="material-symbols-outlined shrink-0 text-[18px] text-primary">
        smart_toy
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <code className="truncate font-mono text-xs font-semibold text-text-main">
            {model.id}
          </code>
          {model.owned_by && (
            <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted">
              {model.owned_by}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {CAPABILITY_FILTERS.filter(
            (f) => f.key !== "all" && caps[f.key],
          ).map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              <span className="material-symbols-outlined text-[11px]">
                {f.icon}
              </span>
              {f.label}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onCopy(model.id, copyId)}
        title="Copy model ID"
        aria-label="Copy model ID"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          copied === copyId
            ? "text-green-600"
            : "text-text-muted hover:bg-surface-2 hover:text-primary",
        )}
      >
        <span className="material-symbols-outlined text-[16px]">
          {copied === copyId ? "check" : "content_copy"}
        </span>
      </button>
    </div>
  );
}
