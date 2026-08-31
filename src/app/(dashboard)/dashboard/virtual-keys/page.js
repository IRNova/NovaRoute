"use client";

import { useState, useEffect, useCallback } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import Input from "@/shared/components/Input";
import Modal, { ConfirmModal } from "@/shared/components/Modal";
import { translate } from "@/i18n/runtime";
import { useNotificationStore } from "@/store/notificationStore";

export default function VirtualKeysPage() {
  const notify = useNotificationStore();
  const [keys, setKeys] = useState([]);
  const [spend, setSpend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ name: "", tier: "standard", budgetLimit: "" });

  const load = useCallback(async () => {
    try {
      const [k, s] = await Promise.all([
        fetch("/api/virtual-keys?action=list").then((r) => r.json()),
        fetch("/api/virtual-keys?action=spend").then((r) => r.json()),
      ]);
      setKeys(Array.isArray(k?.keys) ? k.keys : []);
      setSpend(s?.spend ?? null);
    } catch {
      notify.error(translate("Failed to load virtual keys"));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const createKey = async () => {
    if (!form.name.trim()) return notify.error(translate("Name is required"));
    setBusy(true);
    try {
      const body = { name: form.name.trim(), tier: form.tier || "standard" };
      if (form.budgetLimit && Number(form.budgetLimit) > 0) {
        body.budget = { limit: Number(form.budgetLimit) };
      }
      const res = await fetch("/api/virtual-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok || d.success === false) throw new Error(d.error || translate("Request failed"));
      setShowCreate(false);
      setForm({ name: "", tier: "standard", budgetLimit: "" });
      notify.success(translate("Virtual key created"));
      await load();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteKey = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/virtual-keys?keyId=${encodeURIComponent(confirmDelete)}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || translate("Failed to delete key"));
      notify.success(translate("Key deleted"));
      setConfirmDelete(null);
      await load();
    } catch (err) {
      notify.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const spendTotal = typeof spend === "number" ? spend : typeof spend?.total === "number" ? spend.total : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Virtual Keys")}</h1>
          <p className="text-sm text-text-muted mt-1">{translate("Budget-scoped proxy keys with per-key spend tracking")}</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {translate("Create Key")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-[10px] bg-primary/10 material-symbols-outlined text-primary">vpn_key</span>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide">{translate("Active Keys")}</p>
              <p className="text-2xl font-bold text-text-main">{keys.length}</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-[10px] bg-success/10 material-symbols-outlined text-success">payments</span>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide">{translate("Total Spend")}</p>
              <p className="text-2xl font-bold text-text-main" dir="ltr">
                {spendTotal !== null ? `$${Number(spendTotal).toFixed(2)}` : "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title={translate("Keys")} subtitle={translate("Scoped keys issued by the virtual key manager")}>
        {keys.length === 0 ? (
          <p className="text-sm text-text-muted">{translate("No virtual keys yet — create one to scope budgets and track spend.")}</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.keyId || k.id || k.name} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-3/50 border border-border-subtle">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-main truncate">{k.name || k.keyId || k.id}</p>
                    {k.tier ? <Badge variant="info">{String(k.tier)}</Badge> : null}
                  </div>
                  <p className="text-xs text-text-muted truncate" dir="ltr">
                    {k.keyId || k.id || ""}
                    {typeof k.budget?.limit === "number" ? ` · ${translate("budget")} $${k.budget.limit}` : ""}
                  </p>
                </div>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirmDelete(k.keyId || k.id)}>
                  {translate("Delete")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={translate("Create Virtual Key")}>
        <div className="space-y-4">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={translate("Key name")} />
          <Input value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} placeholder={translate("Tier (e.g. standard)")} />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.budgetLimit}
            onChange={(e) => setForm({ ...form, budgetLimit: e.target.value })}
            placeholder={translate("Budget limit in $ (optional)")}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              {translate("Cancel")}
            </Button>
            <Button variant="primary" disabled={busy} onClick={createKey}>
              {translate("Create")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deleteKey}
        title={translate("Delete key")}
        message={translate("Clients using it will stop working after deletion.")}
        confirmText={translate("Delete")}
        variant="danger"
      />
    </div>
  );
}
