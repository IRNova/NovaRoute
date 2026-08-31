"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Button, Modal, Input, CardSkeleton, ModelSelectModal, ConfirmModal, CapacityBadges, Select } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { cn } from "@/shared/utils/cn";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { translate } from "@/i18n/runtime";
import {
  COMBO_STRATEGIES,
  COMBO_STRATEGY_BY_ID,
  COMBO_STRATEGY_CONFIG_FIELDS,
} from "@/shared/constants/comboStrategies";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState([]);
  const [comboStrategies, setComboStrategies] = useState({});
  const [strategyFilter, setStrategyFilter] = useState("all");
  const { getCaps } = useModelCaps();
  const [confirmState, setConfirmState] = useState(null);
  const { copied, copy } = useCopyToClipboard();
  const notify = useNotificationStore();
  const [suggestions, setSuggestions] = useState([]);
  const [applyingSuggestion, setApplyingSuggestion] = useState(null);

  const fetchSuggestions = async () => {
    try {
      const res = await fetch("/api/combos/suggestions");
      const d = await res.json();
      setSuggestions(Array.isArray(d?.suggestions) ? d.suggestions : []);
    } catch {
      setSuggestions([]);
    }
  };

  const applySuggestion = async (s) => {
    setApplyingSuggestion(s.name);
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: s.name, models: s.models }),
      });
      if (!res.ok) throw new Error("Failed to create combo");
      notify.success(translate("Combo created from suggestion"));
      await Promise.all([fetchData(), fetchSuggestions()]);
    } catch (err) {
      notify.error(err.message || translate("Failed to create combo"));
    } finally {
      setApplyingSuggestion(null);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const autoOrderCombo = async (comboId) => {
    try {
      const res = await fetch(`/api/combos/${comboId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: "general" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || translate("Failed to reorder"));
      notify.success(translate("Combo reordered by success rate"));
      await fetchData();
    } catch (err) {
      notify.error(err.message);
    }
  };

  const fetchData = async () => {
    try {
      const [combosRes, providersRes, settingsRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/providers"),
        fetch("/api/settings"),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};

      // Only LLM combos here - webSearch/webFetch combos belong to media-providers/web
      if (combosRes.ok) setCombos((combosData.combos || []).filter((c) => !c.kind || c.kind === "llm"));
      if (providersRes.ok) {
        setActiveProviders(providersData.connections || []);
      }
      setComboStrategies(settingsData.comboStrategies || {});
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const handleCreate = async (data) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setShowCreateModal(false);
      } else {
        const err = await res.json();
        notify.error(err.error || "Failed to create combo");
      }
    } catch (error) {
      console.log("Error creating combo:", error);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setEditingCombo(null);
      } else {
        const err = await res.json();
        notify.error(err.error || "Failed to update combo");
      }
    } catch (error) {
      console.log("Error updating combo:", error);
    }
  };

  const handleDelete = async (id) => {
    setConfirmState({
      title: "Delete Combo",
      message: "Delete this combo?",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
          if (res.ok) {
            setCombos(combos.filter((c) => c.id !== id));
          }
        } catch (error) {
          console.log("Error deleting combo:", error);
        }
      },
    });
  };

  // Duplicate a combo: strip any trailing "-copy" / "-copy-N" suffix from the
  // base name, then pick the next free "-copy" name (mirrors omni's
  // handleDuplicate). Reuses the create flow so validation/errors stay in one
  // place.
  const handleDuplicate = async (combo) => {
    const baseName = combo.name.replace(/-copy(-\d+)?$/, "");
    const existingNames = combos.map((c) => c.name);
    let newName = `${baseName}-copy`;
    let counter = 1;
    while (existingNames.includes(newName)) {
      counter += 1;
      newName = `${baseName}-copy-${counter}`;
    }
    await handleCreate({ name: newName, models: combo.models, kind: combo.kind });

    // Carry over the strategy config (keyed by combo name) so the copy keeps it.
    const srcStrategy = comboStrategies[combo.name];
    if (srcStrategy) {
      try {
        const updated = { ...comboStrategies, [newName]: { ...srcStrategy } };
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comboStrategies: updated }),
        });
        setComboStrategies(updated);
      } catch (error) {
        console.log("Error copying combo strategy:", error);
      }
    }
  };

  // Merge a per-combo strategy patch into settings.comboStrategies.
  const handleSetComboStrategy = async (comboName, patch) => {
    try {
      const updated = { ...comboStrategies };
      const next = { ...(updated[comboName] || {}), ...patch };
      if (!next.fallbackStrategy || next.fallbackStrategy === "fallback") {
        delete updated[comboName];
      } else {
        updated[comboName] = next;
      }

      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStrategies: updated }),
      });

      setComboStrategies(updated);
    } catch (error) {
      console.log("Error updating combo strategy:", error);
    }
  };

  const strategyCounts = useMemo(() => {
    const counts = { all: combos.length };
    for (const s of COMBO_STRATEGIES) counts[s.id] = 0;
    for (const combo of combos) {
      const key = comboStrategies[combo.name]?.fallbackStrategy || "fallback";
      if (key in counts) counts[key] += 1;
    }
    return counts;
  }, [combos, comboStrategies]);

  const visibleCombos =
    strategyFilter === "all"
      ? combos
      : combos.filter(
          (combo) =>
            (comboStrategies[combo.name]?.fallbackStrategy || "fallback") ===
            strategyFilter,
        );

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 animate-in fade-in duration-300">
      {/* Title and subtitle come from the app header. The Create Combo action
          stays: the empty state's copy of it only appears when no combos
          exist, so this is the only always-available entry point. */}
      <div className="flex justify-end">
        <Button icon="add" onClick={() => setShowCreateModal(true)}>
          {translate("Create Combo")}
        </Button>
      </div>

      {/* Smart suggestions computed from real 7-day usage stats */}
      {suggestions.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
            <h3 className="text-sm font-semibold text-text-main">{translate("Suggested from your traffic")}</h3>
          </div>
          {suggestions.map((s) => (
            <div
              key={s.name}
              className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[14px] bg-surface border border-border-subtle shadow-[var(--shadow-soft)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-text-main" dir="ltr">{s.name}</p>
                  {typeof s.weeklyRequests === "number" && s.weeklyRequests > 0 ? (
                    <span className="text-xs text-text-muted">
                      ~{s.weeklyRequests.toLocaleString()} {translate("req/week")}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-text-muted mb-2">{translate(s.reason)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(s.models || []).map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-lg bg-surface-3/60 border border-border-subtle text-xs font-mono text-text-muted" dir="ltr">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={applyingSuggestion === s.name || combos.some((c) => c.name === s.name)}
                onClick={() => applySuggestion(s)}
              >
                {combos.some((c) => c.name === s.name)
                  ? translate("Already created")
                  : applyingSuggestion === s.name
                    ? translate("Creating...")
                    : translate("Create combo")}
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* Combos List */}
      {combos.length === 0 ? (
        <EmptyCombosState onCreate={() => setShowCreateModal(true)} />
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeader icon="layers" title={translate("Your Combos")} count={combos.length} />
            <div className="flex flex-wrap items-center gap-1.5">
              {STRATEGY_FILTER_OPTIONS.map((option) => {
                const active = strategyFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStrategyFilter(option.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-text-muted hover:bg-surface-2 hover:text-text-main"
                    )}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {option.icon}
                    </span>
                    <span>{option.label}</span>
                    <span className="text-[10px] tabular-nums opacity-70">
                      {strategyCounts[option.value] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {visibleCombos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/70 p-8 text-center">
              <span className="material-symbols-outlined inline-block text-[28px] text-text-muted mb-2">
                filter_alt_off
              </span>
              <p className="text-sm text-text-muted">
                {translate("No combos use this strategy. Pick it from a combo's strategy dropdown.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {visibleCombos.map((combo) => (
                <ComboCard
                  key={combo.id}
                  combo={combo}
                  getCaps={getCaps}
                  activeProviders={activeProviders}
                  copied={copied}
                  onCopy={copy}
                  onEdit={() => setEditingCombo(combo)}
                  onDelete={() => handleDelete(combo.id)}
                  onDuplicate={() => handleDuplicate(combo)}
                  onAutoOrder={() => autoOrderCombo(combo.id)}
                  strategy={comboStrategies[combo.name] || {}}
                  onSetStrategy={(patch) => handleSetComboStrategy(combo.name, patch)}
                  onClick={() => setEditingCombo(combo)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ComboFormModal
          key="create"
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
          activeProviders={activeProviders}
        />
      )}

      {editingCombo && (
        <ComboFormModal
          key={editingCombo.id}
          isOpen={!!editingCombo}
          combo={editingCombo}
          onClose={() => setEditingCombo(null)}
          onSave={(data) => handleUpdate(editingCombo.id, data)}
          activeProviders={activeProviders}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </div>
  );
}

function SectionHeader({ icon, title, count }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary shrink-0">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-2 text-text-muted">
              {count}
            </span>
          )}
        </h2>
      </div>
    </div>
  );
}

function EmptyCombosState({ onCreate }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/70 p-10 text-center">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 text-primary mb-4">
        <span className="material-symbols-outlined text-[32px]">layers</span>
      </div>
      <h3 className="text-lg font-semibold text-text-main mb-1">{translate("No combos yet")}</h3>
      <p className="text-sm text-text-muted mb-5 max-w-md mx-auto">{translate("Create a combo to group models and apply fallback, round-robin, fusion, or 10+ smarter routing strategies.")}</p>
      <Button icon="add" onClick={onCreate}>
        {translate("Create Combo")}
      </Button>
    </div>
  );
}

const STRATEGY_OPTIONS = COMBO_STRATEGIES.map((s) => ({ value: s.id, label: s.label }));

const STRATEGY_FILTER_OPTIONS = [
  { value: "all", label: "All", icon: "apps" },
  ...COMBO_STRATEGIES.map((s) => ({ value: s.id, label: s.label, icon: s.icon })),
];

function ComboCard({ combo, getCaps, activeProviders = [], copied, onCopy, onEdit, onDelete, onDuplicate, strategy = {}, onSetStrategy, onClick }) {
  const [showJudgeSelect, setShowJudgeSelect] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const current = strategy.fallbackStrategy || "fallback";
  const judge = strategy.judgeModel || "";
  const isFusion = current === "fusion";
  const strategyDef = COMBO_STRATEGY_BY_ID[current] || COMBO_STRATEGY_BY_ID.fallback;

  const strategyMeta = {
    ...strategyDef,
    color: "bg-primary/10 text-primary",
    desc: strategyDef.description,
  };

  return (
    <div className="group rounded-2xl border border-border bg-surface p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer" onClick={onClick}>
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: icon + name + models */}
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[24px]">layers</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-base font-mono font-semibold text-text-main truncate">{combo.name}</code>
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide", strategyMeta.color)}>
                <span className="material-symbols-outlined text-[12px]">{strategyMeta.icon}</span>
                {STRATEGY_OPTIONS.find((o) => o.value === current)?.label}
              </span>
            </div>

            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
              {combo.models.length === 0 ? (
                <span className="text-xs text-text-muted italic">No models</span>
              ) : (
                combo.models.map((model, index) => (
                  <code
                    key={index}
                    className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-text-muted"
                  >
                    <span className="truncate max-w-[180px]">{model}</span>
                    <CapacityBadges caps={getCaps?.(model)} />
                  </code>
                ))
              )}
            </div>

            {isFusion && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-text-muted">{translate("Judge")}:</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowJudgeSelect(true); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-primary/40 px-2 py-1 text-xs font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors"
                  title="Pick the model that fuses panel answers"
                >
                  <span className="material-symbols-outlined text-[13px]">gavel</span>
                  <span className="truncate max-w-[200px]">{judge || `Auto — ${combo.models[0] || "first model"}`}</span>
                </button>
                {judge && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSetStrategy({ judgeModel: "" }); }}
                    className="p-1 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Reset judge to Auto"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: strategy + actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="w-full sm:w-40">
            <Select
              options={STRATEGY_OPTIONS}
              value={current}
              onChange={(e) => onSetStrategy({ fallbackStrategy: e.target.value })}
              selectClassName="py-2 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              onClick={(e) => { e.stopPropagation(); onCopy(combo.name, `combo-${combo.id}`); }}
              icon={copied === `combo-${combo.id}` ? "check" : "content_copy"}
              title={translate("Copy combo name")}
              active={copied === `combo-${combo.id}`}
            />
            {strategyDef.configurable && (
              <IconButton
                onClick={(e) => { e.stopPropagation(); setShowConfig((v) => !v); }}
                icon="tune"
                title={translate("Strategy settings")}
                active={showConfig}
              />
            )}
            <IconButton onClick={(e) => { e.stopPropagation(); onDuplicate(); }} icon="copy_all" title={translate("Duplicate combo")} />
            <IconButton onClick={(e) => { e.stopPropagation(); onAutoOrder(); }} icon="low_priority" title={translate("Auto-order by success rate")} />
          <IconButton onClick={(e) => { e.stopPropagation(); onEdit(); }} icon="edit" title={translate("Edit combo")} />
            <IconButton onClick={(e) => { e.stopPropagation(); onDelete(); }} icon="delete" title={translate("Delete combo")} danger />
          </div>
        </div>
      </div>

      {showConfig && strategyDef.configurable && (
        <StrategyConfigPanel
          combo={combo}
          strategy={current}
          config={strategy}
          activeProviders={activeProviders}
          onSetConfig={(patch) => onSetStrategy(patch)}
        />
      )}

      {showJudgeSelect && (
        <ModelSelectModal
          isOpen={showJudgeSelect}
          onClose={() => setShowJudgeSelect(false)}
          onSelect={(m) => { onSetStrategy({ judgeModel: m?.value || "" }); setShowJudgeSelect(false); }}
          activeProviders={activeProviders}
          title="Select Judge Model"
          addedModelValues={judge ? [judge] : []}
          closeOnSelect={true}
        />
      )}
    </div>
  );
}

function IconButton({ onClick, icon, title, active, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex items-center justify-center size-9 rounded-lg transition-colors",
        danger
          ? "text-text-muted hover:text-red-500 hover:bg-red-500/10"
          : active
            ? "text-green-600 bg-green-500/10"
            : "text-text-muted hover:text-primary hover:bg-surface-2"
      )}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

const AUTO_WEIGHT_KEYS = [
  { key: "cost", label: "Cost" },
  { key: "latency", label: "Latency" },
  { key: "quality", label: "Quality" },
];

// Per-strategy settings: rendered below a combo card when its strategy exposes
// config fields (round-robin, fill-first, weighted, auto). Patches are merged
// into settings.comboStrategies[name] via onSetConfig → onSetStrategy.
function StrategyConfigPanel({ combo, strategy, config = {}, onSetConfig }) {
  const fields = COMBO_STRATEGY_CONFIG_FIELDS[strategy] || [];
  if (fields.length === 0) return null;

  const renderNumberField = (label, hint, value, onChange, { min = 0, max = null, step = 1 } = {}) => (
    <label className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="block text-sm font-medium text-text-main">{label}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="w-24 shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-xs text-text-main outline-none focus:border-primary/40"
      />
    </label>
  );

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-surface-2/40 p-4" onClick={(e) => e.stopPropagation()}>
        {fields.includes("stickyLimit") &&
        renderNumberField(
          translate("Requests per model"),
          translate("Consecutive requests each model handles before rotating."),
          config.stickyLimit ?? 1,
          (v) => onSetConfig({ stickyLimit: v }),
          { min: 1, step: 1 }
        )}
      {fields.includes("requestsPerModel") &&
        renderNumberField(
          translate("Requests per model"),
          translate("Use each model for this many consecutive requests before moving on."),
          config.requestsPerModel ?? 1,
          (v) => onSetConfig({ requestsPerModel: v }),
          { min: 1, step: 1 }
        )}
      {fields.includes("weights") && (
        <div className="flex flex-col gap-2">
          <div>
            <span className="block text-sm font-medium text-text-main">{translate("Model weights")}</span>
            <span className="block text-xs text-text-muted">{translate("Relative pick probability. Higher = used more often.")}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {(combo.models || []).map((m) => (
              <div key={m} className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">{m}</code>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="1"
                  value={config.weights?.[m] ?? ""}
                  onChange={(e) => {
                    const next = { ...(config.weights || {}) };
                    if (e.target.value === "") delete next[m];
                    else next[m] = Number(e.target.value);
                    onSetConfig({ weights: next });
                  }}
                  className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-xs text-text-main outline-none focus:border-primary/40"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {fields.includes("autoWeights") && (
        <div className="flex flex-col gap-2">
          <div>
            <span className="block text-sm font-medium text-text-main">{translate("Auto weights")}</span>
            <span className="block text-xs text-text-muted">{translate("Blend of cost / latency / quality (0–1 each). Blank = task default.")}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {AUTO_WEIGHT_KEYS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-text-main">{label}</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  placeholder="default"
                  value={config.autoWeights?.[key] ?? ""}
                  onChange={(e) => {
                    const next = { ...(config.autoWeights || {}) };
                    if (e.target.value === "") delete next[key];
                    else next[key] = Math.min(1, Math.max(0, Number(e.target.value)));
                    onSetConfig({ autoWeights: next });
                  }}
                  className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-right text-xs text-text-main outline-none focus:border-primary/40"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelItem({ id, index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model) onEdit(trimmed);
    else setDraft(model);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(model); setEditing(false); }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 bg-surface-2/60 transition-colors",
        isDragging && "shadow-md ring-1 ring-primary/30"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab touch-none p-1 rounded text-text-muted hover:text-primary active:cursor-grabbing shrink-0"
        title="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="4" r="2"/><circle cx="15" cy="4" r="2"/>
          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="20" r="2"/><circle cx="15" cy="20" r="2"/>
        </svg>
      </button>

      <span className="text-[10px] font-medium text-text-muted w-4 text-center shrink-0">{index + 1}</span>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded-lg border border-primary/40 bg-surface px-2 py-1 font-mono text-xs text-text-main outline-none"
        />
      ) : (
        <div
          className="min-w-0 flex-1 cursor-text truncate rounded-lg px-2 py-1 font-mono text-xs text-text-main hover:bg-surface-3"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {model}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <button onClick={onMoveUp} disabled={isFirst} className={cn("p-1 rounded", isFirst ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-surface-3")} title="Move up">
          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
        </button>
        <button onClick={onMoveDown} disabled={isLast} className={cn("p-1 rounded", isLast ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-surface-3")} title="Move down">
          <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
        </button>
      </div>

      <button onClick={onRemove} className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Remove">
        <span className="material-symbols-outlined text-[12px]">close</span>
      </button>
    </div>
  );
}

function ComboFormModal({ isOpen, combo, onClose, onSave, activeProviders, kindFilter = null }) {
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState(combo?.models || []);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modelAliases, setModelAliases] = useState({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const modelItems = models.map((model, i) => ({ uid: `item-${i}`, model }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = modelItems.findIndex((m) => m.uid === active.id);
      const newIndex = modelItems.findIndex((m) => m.uid === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setModels((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/models/alias")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setModelAliases(data.aliases || {});
      })
      .catch((error) => console.error("Error fetching modal data:", error));
    return () => { cancelled = true; };
  }, [isOpen]);

  const validateName = (value) => {
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError("Only letters, numbers, -, _ and . allowed");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const handleAddModel = (model) => {
    if (!models.includes(model.value)) {
      setModels([...models, model.value]);
    }
  };

  const handleDeselectModel = (model) => {
    setModels(models.filter((m) => m !== model.value));
  };

  const handleRemoveModel = (index) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newModels = [...models];
    [newModels[index - 1], newModels[index]] = [newModels[index], newModels[index - 1]];
    setModels(newModels);
  };

  const handleMoveDown = (index) => {
    if (index === models.length - 1) return;
    const newModels = [...models];
    [newModels[index], newModels[index + 1]] = [newModels[index + 1], newModels[index]];
    setModels(newModels);
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    setSaving(true);
    await onSave({ name: name.trim(), models });
    setSaving(false);
  };

  const isEdit = !!combo;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? translate("Edit Combo") : translate("Create Combo")}
      >
        <div className="flex flex-col gap-4">
          <div>
            <Input
              label={translate("Combo Name")}
              value={name}
              onChange={handleNameChange}
              placeholder="my-combo"
              error={nameError}
            />
            <p className="text-[10px] text-text-muted mt-0.5">{translate("Only letters, numbers, -, _ and . allowed")}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">{translate("Models")}</label>
            {models.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border rounded-xl bg-surface-2/30">
                <span className="material-symbols-outlined text-text-muted text-2xl mb-1">layers</span>
                <p className="text-xs text-text-muted">{translate("No models added yet")}</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
                <SortableContext items={modelItems.map((m) => m.uid)} strategy={verticalListSortingStrategy}>
                  <div className="flex max-h-[55vh] min-w-0 flex-col gap-1.5 overflow-y-auto sm:max-h-[350px]">
                    {modelItems.map(({ uid, model }, index) => (
                      <ModelItem
                        key={uid}
                        id={uid}
                        index={index}
                        model={model}
                        isFirst={index === 0}
                        isLast={index === modelItems.length - 1}
                        onEdit={(newVal) => {
                          const updated = [...models];
                          updated[index] = newVal;
                          setModels(updated);
                        }}
                        onMoveUp={() => handleMoveUp(index)}
                        onMoveDown={() => handleMoveDown(index)}
                        onRemove={() => handleRemoveModel(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <button
              onClick={() => setShowModelSelect(true)}
              className="w-full mt-3 py-2.5 border border-dashed border-primary/40 rounded-xl text-xs font-semibold text-primary hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {translate("Add Model")}
            </button>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              {translate("Cancel")}
            </Button>
            <Button
              onClick={handleSave}
              fullWidth
              size="sm"
              disabled={!name.trim() || !!nameError || saving}
            >
              {saving ? translate("Saving...") : isEdit ? translate("Save") : translate("Create")}
            </Button>
          </div>
        </div>
      </Modal>

      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAddModel}
          onDeselect={handleDeselectModel}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title="Add Model to Combo"
          kindFilter={kindFilter}
          addedModelValues={models}
          closeOnSelect={false}
        />
      )}
    </>
  );
}
