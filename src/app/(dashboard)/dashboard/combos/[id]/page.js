"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, CardSkeleton, CapacityBadges, Select, ConfirmModal } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  COMBO_STRATEGIES,
  COMBO_STRATEGY_BY_ID,
} from "@/shared/constants/comboStrategies";

const STRATEGY_OPTIONS = COMBO_STRATEGIES.map((s) => ({ value: s.id, label: s.label }));

export default function ComboDetailPage() {
  const params = useParams();
  const router = useRouter();
  const comboId = params.id;
  const { getCaps } = useModelCaps();
  const { copied, copy } = useCopyToClipboard();
  const notify = useNotificationStore();

  const [combo, setCombo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [strategy, setStrategy] = useState({});
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [models, setModels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [comboRes, settingsRes] = await Promise.all([
          fetch(`/api/combos/${comboId}`),
          fetch("/api/settings"),
        ]);

        if (!comboRes.ok) {
          setError("Combo not found");
          setLoading(false);
          return;
        }

        const comboData = await comboRes.json();
        setCombo(comboData);
        setName(comboData.name);
        setModels(comboData.models || []);

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setStrategy(settingsData.comboStrategies?.[comboData.name] || {});
        }
      } catch (err) {
        setError("Failed to load combo");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [comboId]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/combos/${comboId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), models }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCombo(updated);
        setEditing(false);
        notify.success("Combo updated");
      } else {
        const err = await res.json();
        notify.error(err.error || "Failed to update combo");
      }
    } catch {
      notify.error("Failed to update combo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      const res = await fetch(`/api/combos/${comboId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard/combos");
      } else {
        notify.error("Failed to delete combo");
      }
    } catch {
      notify.error("Failed to delete combo");
    }
  };

  const handleSetStrategy = async (patch) => {
    try {
      const updated = { ...strategy, ...patch };
      if (!updated.fallbackStrategy || updated.fallbackStrategy === "fallback") {
        delete updated.fallbackStrategy;
      }
      setStrategy(updated);

      const settingsRes = await fetch("/api/settings");
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      const allStrategies = { ...(settingsData.comboStrategies || {}), [combo.name]: updated };
      if (!updated.fallbackStrategy) delete allStrategies[combo.name];

      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStrategies: allStrategies }),
      });
    } catch {
      notify.error("Failed to update strategy");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
      </div>
    );
  }

  if (error || !combo) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-outlined text-[48px] text-text-muted">error</span>
        <h2 className="text-lg font-semibold text-text-main">{error || "Combo not found"}</h2>
        <Link href="/dashboard/combos">
          <Button variant="ghost" icon="arrow_back">Back to Combos</Button>
        </Link>
      </div>
    );
  }

  const currentStrategy = strategy.fallbackStrategy || "fallback";
  const strategyDef = COMBO_STRATEGY_BY_ID[currentStrategy] || COMBO_STRATEGY_BY_ID.fallback;

  return (
    <div className="flex min-w-0 flex-col gap-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/combos" className="flex items-center justify-center size-9 rounded-lg text-text-muted hover:text-primary hover:bg-surface-2 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xl font-mono font-bold text-text-main truncate">{combo.name}</code>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[12px]">{strategyDef.icon}</span>
              {STRATEGY_OPTIONS.find((o) => o.value === currentStrategy)?.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => copy(combo.name, `combo-${combo.id}`)}
            className="flex items-center justify-center size-9 rounded-lg text-text-muted hover:text-primary hover:bg-surface-2 transition-colors"
            title="Copy combo name"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied === `combo-${combo.id}` ? "check" : "content_copy"}
            </span>
          </button>
          <Button icon="edit" variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button icon="delete" variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="text-text-muted hover:text-red-500">
            Delete
          </Button>
        </div>
      </div>

      {/* Combo Details */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Name</label>
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-main font-mono outline-none focus:border-primary/40"
              />
            ) : (
              <code className="block mt-1 text-base font-mono font-semibold text-text-main">{combo.name}</code>
            )}
          </div>

          {/* Strategy */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Strategy</label>
            <div className="mt-1 w-full sm:w-48">
              <Select
                options={STRATEGY_OPTIONS}
                value={currentStrategy}
                onChange={(e) => handleSetStrategy({ fallbackStrategy: e.target.value })}
                selectClassName="py-2 text-xs"
              />
            </div>
          </div>

          {/* Models */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Models</label>
            {combo.models.length === 0 ? (
              <p className="mt-1 text-sm text-text-muted italic">No models configured</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {combo.models.map((model, index) => (
                  <code
                    key={index}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-muted border border-border"
                  >
                    <span className="truncate max-w-[240px]">{model}</span>
                    <CapacityBadges caps={getCaps?.(model)} />
                  </code>
                ))}
              </div>
            )}
          </div>

          {/* Kind */}
          {combo.kind && (
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Kind</label>
              <span className="block mt-1 text-sm text-text-main">{combo.kind}</span>
            </div>
          )}

          {/* Edit Actions */}
          {editing && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button onClick={handleSave} size="sm" disabled={!name.trim() || saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button onClick={() => { setEditing(false); setName(combo.name); setModels(combo.models || []); }} variant="ghost" size="sm">
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Combo"
        message={`Delete combo "${combo.name}"? This cannot be undone.`}
        variant="danger"
      />
    </div>
  );
}
