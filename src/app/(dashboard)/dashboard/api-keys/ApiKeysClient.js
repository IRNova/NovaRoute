"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Input, Toggle, Modal, ConfirmModal, CardSkeleton } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { cn } from "@/shared/utils/cn";
import SecurityWarning from "../endpoint/components/SecurityWarning";
import { translate } from "@/i18n/runtime";

const SCOPES = ["manage"];

const parseModels = (value) =>
  (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export default function ApiKeysClient() {
  const [keys, setKeys] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [isRemoteHost, setIsRemoteHost] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [keyUsage, setKeyUsage] = useState({});
  const [newKeyForm, setNewKeyForm] = useState({
    noLog: false,
    allowUsageCommand: false,
    usageLimitEnabled: false,
    rpmLimit: "",
    concurrencyLimit: "",
    dailyUsageLimitUsd: "",
    weeklyUsageLimitUsd: "",
    modelAccessMode: "all", expiresAt: "",
    allowedModels: "",
  });

  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    if (typeof window !== "undefined")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRemoteHost(!["localhost", "127.0.0.1", "::1"].includes(window.location.hostname));
  }, []);

  const loadKeys = useCallback(async () => {
    try {
      let existing = [];
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        existing = data.keys || [];
      }
      // Auto-provision a default key for first-time users so the endpoint works out of the box.
      if (existing.length === 0) {
        try {
          const createRes = await fetch("/api/keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Default Key" }),
          });
          if (createRes.ok) {
            const list = await fetch("/api/keys");
            if (list.ok) existing = (await list.json()).keys || [];
          }
        } catch { /* fall through to empty render */ }
      }
      setKeys(existing);
    } catch (error) {
      console.log("Error loading keys:", error);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/keys/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.log("Error loading key groups:", error);
    }
  }, []);

  const loadKeyUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/keys/usage");
      if (res.ok) {
        const data = await res.json();
        setKeyUsage(data.usage || {});
      }
    } catch (error) {
      console.log("Error loading key usage:", error);
    }
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setRequireApiKey(data.requireApiKey || false);
      }
    } catch (error) {
      console.log("Error loading settings:", error);
    }
  };

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.allSettled([loadKeys(), loadGroups(), loadSettings(), loadKeyUsage()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadKeys, loadGroups, loadKeyUsage]);

  const handleRequireApiKey = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApiKey: value }),
      });
      if (res.ok) setRequireApiKey(value);
    } catch (error) {
      console.log("Error updating requireApiKey:", error);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          scopes: SCOPES,
          noLog: newKeyForm.noLog,
          allowUsageCommand: newKeyForm.allowUsageCommand,
          usageLimitEnabled: newKeyForm.usageLimitEnabled,
          rpmLimit: newKeyForm.rpmLimit === "" ? null : Number(newKeyForm.rpmLimit),
          concurrencyLimit: newKeyForm.concurrencyLimit === "" ? null : Number(newKeyForm.concurrencyLimit),
          dailyUsageLimitUsd: newKeyForm.dailyUsageLimitUsd === "" ? null : Number(newKeyForm.dailyUsageLimitUsd),
          weeklyUsageLimitUsd: newKeyForm.weeklyUsageLimitUsd === "" ? null : Number(newKeyForm.weeklyUsageLimitUsd),
          modelAccessMode: newKeyForm.modelAccessMode,
          allowedModels: parseModels(newKeyForm.allowedModels),
          expiresAt: newKeyForm.expiresAt || null,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setCreatedKey(data.key);
        await loadKeys();
        setNewKeyName("");
        setNewKeyForm({
          noLog: false,
          allowUsageCommand: false,
          usageLimitEnabled: false,
          dailyUsageLimitUsd: "",
          weeklyUsageLimitUsd: "",
          modelAccessMode: "all", expiresAt: "",
          allowedModels: "",
        });
        setShowAddModal(false);
      }
    } catch (error) {
      console.log("Error creating key:", error);
    }
  };

  const handleDeleteKey = async (id) => {
    setConfirmState({
      title: translate("Delete API Key"),
      message: translate("Are you sure you want to delete") + " " + keys.find((k) => k.id === id)?.name + "? " + translate("This action cannot be undone."),
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
          if (res.ok) {
            setKeys((prev) => prev.filter((k) => k.id !== id));
          }
        } catch (error) {
          console.log("Error deleting key:", error);
        }
      },
    });
  };

  const handleToggleKey = async (id, isActive) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, isActive } : k)));
      }
    } catch (error) {
      console.log("Error toggling key:", error);
    }
  };

  const handleRegenerateKey = (key) => {
    setConfirmState({
      title: "Regenerate API Key",
      message: `Generate a new key value for "${key.name}"?\n\nThe old key will stop working immediately.`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/keys/${key.id}/regenerate`, { method: "POST" });
          if (res.ok) {
            const data = await res.json();
            setCreatedKey(data.key);
            await loadKeys();
          }
        } catch (error) {
          console.log("Error regenerating key:", error);
        }
      },
    });
  };

  const handleRevealKey = async (key) => {
    try {
      const res = await fetch(`/api/keys/${key.id}/reveal`);
      if (res.ok) {
        const data = await res.json();
        copy(data.key, key.id);
        return;
      }
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to reveal key");
    } catch (error) {
      console.log("Error revealing key:", error);
    }
  };

  const handleCopyKey = async (key) => {
    try {
      const res = await fetch(`/api/keys/${key.id}/reveal`);
      if (res.ok) {
        const data = await res.json();
        copy(data.key, key.id);
        return;
      }
    } catch {}
    copy(key.key, key.id);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const totalKeys = keys.length;
  const activeKeys = keys.filter((k) => k.isActive !== false).length;
  const pausedKeys = totalKeys - activeKeys;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">vpn_key</span>
            {translate("API Keys")}
          </h1>
          <p className="text-sm text-text-muted mt-1">{translate("Manage keys that protect your API endpoint.")}</p>
        </div>
        <Button icon="add" onClick={() => setShowAddModal(true)}>
          {translate("Create Key")}
        </Button>
      </div>

      {/* Security toggle */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center size-11 rounded-xl bg-primary/10 text-primary shrink-0">
              <span className="material-symbols-outlined text-[22px]">shield</span>
            </div>
            <div>
              <h2 className="font-semibold text-text-main">{translate("Require API key")}</h2>
              <p className="text-sm text-text-muted">{translate("Requests without a valid key will be rejected")}</p>
            </div>
          </div>
          <Toggle
            checked={requireApiKey}
            onChange={() => handleRequireApiKey(!requireApiKey)}
          />
        </div>
        {isRemoteHost && !requireApiKey && (
          <div className="mt-4">
            <SecurityWarning message={translate("Endpoint is exposed without an API key.")} />
          </div>
        )}
      </div>

      {/* Stats */}
      {totalKeys > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon="vpn_key" label={translate("Total Keys")} value={totalKeys} tone="primary" />
          <StatCard icon="check_circle" label={translate("Active")} value={activeKeys} tone="success" />
          <StatCard icon="pause_circle" label={translate("Paused")} value={pausedKeys} tone="warning" />
        </div>
      )}

      {/* Keys grid */}
      {keys.length === 0 ? (
        <EmptyState onCreate={() => setShowAddModal(true)} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {keys.map((key) => (
            <KeyCard
              key={key.id}
              apiKey={key}
              usage={keyUsage[key.id]}
              copied={copied === key.id}
              onReveal={() => handleRevealKey(key)}
              onCopy={() => handleCopyKey(key)}
              onEditPermissions={() => setEditingKey(key)}
              onToggleActive={(checked) => {
                if (key.isActive !== false && !checked) {
                  setConfirmState({
                    title: translate("Pause API Key"),
                    message: translate("Pause") + ` "${key.name}"?\n\n` + translate("This key will stop working immediately but can be resumed later."),
                    onConfirm: async () => {
                      setConfirmState(null);
                      handleToggleKey(key.id, checked);
                    },
                  });
                } else {
                  handleToggleKey(key.id, checked);
                }
              }}
              onRegenerate={() => handleRegenerateKey(key)}
              onDelete={() => handleDeleteKey(key.id)}
            />
          ))}
        </div>
      )}

      {/* Key groups */}
      {groups.length > 0 && (
        <KeyGroupsSection groups={groups} onChanged={loadGroups} />
      )}

      {/* Create Key Modal */}
      <Modal
        isOpen={showAddModal}
        title={translate("Create API Key")}
        onClose={() => {
          setShowAddModal(false);
          setNewKeyName("");
          setNewKeyForm({
            noLog: false,
            allowUsageCommand: false,
            usageLimitEnabled: false,
            dailyUsageLimitUsd: "",
            weeklyUsageLimitUsd: "",
            modelAccessMode: "all", expiresAt: "",
            allowedModels: "",
          });
        }}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/60 border border-border">
            <span className="material-symbols-outlined text-primary text-[22px]">vpn_key</span>
            <p className="text-sm text-text-muted">{translate("Give your key a descriptive name so you can identify it later.")}</p>
          </div>
          <Input
            label={translate("Key Name")}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Production Key"
          />

          {/* Permission flags */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-text-main">{translate("Flags")}</h4>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-text-main">{translate("No logging")}</p>
                <p className="text-xs text-text-muted">{translate("Skip usage logging and spend tracking for this key.")}</p>
              </div>
              <Toggle size="sm" checked={newKeyForm.noLog} onChange={(v) => setNewKeyForm((prev) => ({ ...prev, noLog: v }))} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-text-main">{translate("Allow usage command")}</p>
                <p className="text-xs text-text-muted">{translate("Let this key query its own usage stats.")}</p>
              </div>
              <Toggle size="sm" checked={newKeyForm.allowUsageCommand} onChange={(v) => setNewKeyForm((prev) => ({ ...prev, allowUsageCommand: v }))} />
            </div>
          </div>

          {/* USD usage limits */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-text-main">{translate("USD usage limits")}</h4>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
              <p className="text-sm font-medium text-text-main">{translate("Enable usage limits")}</p>
              <Toggle size="sm" checked={newKeyForm.usageLimitEnabled} onChange={(v) => setNewKeyForm((prev) => ({ ...prev, usageLimitEnabled: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={translate("Daily limit (USD)")}
                type="number"
                min="0"
                step="0.01"
                value={newKeyForm.dailyUsageLimitUsd}
                onChange={(e) => setNewKeyForm((prev) => ({ ...prev, dailyUsageLimitUsd: e.target.value }))}
                disabled={!newKeyForm.usageLimitEnabled}
                placeholder="e.g. 5.00"
              />
              <Input
                label={translate("Weekly limit (USD)")}
                type="number"
                min="0"
                step="0.01"
                value={newKeyForm.weeklyUsageLimitUsd}
                onChange={(e) => setNewKeyForm((prev) => ({ ...prev, weeklyUsageLimitUsd: e.target.value }))}
                disabled={!newKeyForm.usageLimitEnabled}
                placeholder="e.g. 25.00"
              />
            </div>
          </div>

          {/* Request rate limits */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-text-main">{translate("Request limits")}</h4>
            <p className="text-xs text-text-muted">
              {translate("Applied to every gateway call from this key. Leave blank for no limit.")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={translate("Requests per minute")}
                type="number"
                min="0"
                step="1"
                value={newKeyForm.rpmLimit}
                onChange={(e) => setNewKeyForm((prev) => ({ ...prev, rpmLimit: e.target.value }))}
                placeholder="e.g. 60"
              />
              <Input
                label={translate("Concurrent requests")}
                type="number"
                min="0"
                step="1"
                value={newKeyForm.concurrencyLimit}
                onChange={(e) => setNewKeyForm((prev) => ({ ...prev, concurrencyLimit: e.target.value }))}
                placeholder="e.g. 4"
              />
            </div>
          </div>

          {/* Model access */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-text-main">{translate("Model access")}</h4>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={newKeyForm.modelAccessMode === "all" ? "primary" : "ghost"}
                onClick={() => setNewKeyForm((prev) => ({ ...prev, modelAccessMode: "all" }))}
              >
                {translate("All models")}
              </Button>
              <Button
                size="sm"
                variant={newKeyForm.modelAccessMode === "restricted" ? "primary" : "ghost"}
                onClick={() => setNewKeyForm((prev) => ({ ...prev, modelAccessMode: "restricted" }))}
              >
                {translate("Restricted models")}
              </Button>
            </div>
            {newKeyForm.modelAccessMode === "restricted" && (
              <Input
                label={translate("Allowed models (comma-separated)")}
                value={newKeyForm.allowedModels}
                onChange={(e) => setNewKeyForm((prev) => ({ ...prev, allowedModels: e.target.value }))}
                placeholder="gpt-4, claude-3.5-sonnet"
              />
            )}
            <Input
              type="date"
              label={translate("Expires at (optional)")}
              value={newKeyForm.expiresAt}
              onChange={(e) => setNewKeyForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreateKey} fullWidth disabled={!newKeyName.trim()}>
              {translate("Create")}
            </Button>
            <Button
              onClick={() => {
                setShowAddModal(false);
                setNewKeyName("");
                setNewKeyForm({
                  noLog: false,
                  allowUsageCommand: false,
                  usageLimitEnabled: false,
                  dailyUsageLimitUsd: "",
                  weeklyUsageLimitUsd: "",
                  modelAccessMode: "all",
                  allowedModels: "",
                  expiresAt: "",
                });
              }}
              variant="ghost"
              fullWidth
            >
              {translate("Cancel")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Created / Regenerated Key Modal */}
      <Modal
        isOpen={!!createdKey}
        title={translate("API Key Created")}
        onClose={() => setCreatedKey(null)}
      >
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 p-4">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px] shrink-0">warning</span>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{translate("Save this key now")}</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                  {translate("This is the only time you will see it. Store it somewhere secure.")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
              <code className="block w-full text-sm font-mono text-text-main truncate">
                {createdKey || ""}
              </code>
            </div>
            <Button
              variant="secondary"
              icon={copied === "created_key" ? "check" : "content_copy"}
              onClick={() => copy(createdKey, "created_key")}
            >
              {copied === "created_key" ? translate("Copied") : translate("Copy")}
            </Button>
          </div>
          <Button onClick={() => setCreatedKey(null)} fullWidth>
            {translate("Done")}
          </Button>
        </div>
      </Modal>

      {/* Permissions Modal */}
      {editingKey && (
        <PermissionsModal
          key={editingKey.id}
          apiKey={editingKey}
          groups={groups}
          onClose={() => setEditingKey(null)}
          onSaved={async (updated) => {
            setKeys((prev) => prev.map((k) => (k.id === updated.id ? { ...k, ...updated } : k)));
            setEditingKey(null);
          }}
          onGroupsChanged={loadGroups}
        />
      )}

      {/* Confirm Modal */}
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

function StatCard({ icon, label, value, tone }) {
  const toneStyles = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-4 shadow-sm">
      <div className={cn("flex items-center justify-center size-12 rounded-xl border", toneStyles[tone])}>
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-text-main">{value}</p>
        <p className="text-sm text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/70 p-10 text-center">
      <div className="inline-flex items-center justify-center size-16 rounded-full bg-primary/10 text-primary mb-4">
        <span className="material-symbols-outlined text-[32px]">vpn_key</span>
      </div>
      <h3 className="text-lg font-semibold text-text-main mb-1">No API keys yet</h3>
      <p className="text-sm text-text-muted mb-5 max-w-sm mx-auto">Create your first API key to start sending authenticated requests to your endpoint.</p>
      <Button icon="add" onClick={onCreate}>
        Create Key
      </Button>
    </div>
  );
}

function Badge({ icon, label, tone = "neutral" }) {
  const tones = {
    neutral: "bg-surface-2 text-text-muted border-border",
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border", tones[tone])}>
      {icon && <span className="material-symbols-outlined text-[13px]">{icon}</span>}
      {label}
    </span>
  );
}

function KeyCard({ apiKey, usage, copied, onReveal, onCopy, onEditPermissions, onToggleActive, onRegenerate, onDelete }) {
  const isActive = apiKey.isActive !== false;
  const createdAt = apiKey.createdAt
    ? new Date(apiKey.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";
  const expired =
    apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
  const expiringSoon =
    !expired &&
    apiKey.expiresAt &&
    new Date(apiKey.expiresAt).getTime() - Date.now() < 7 * 86400000;

  const keyUsage = usage || { allTime: { requests: 0, cost: 0, tokens: 0 }, today: { requests: 0, cost: 0, tokens: 0 } };

  return (
    <div className="group rounded-2xl border border-border bg-surface p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-text-main truncate">{apiKey.name}</h3>
           <p className="text-xs text-text-muted mt-0.5">{translate("Created")} {createdAt}</p>
           {apiKey.expiresAt && (
             <p className={`text-xs mt-0.5 ${expired ? "text-danger font-semibold" : expiringSoon ? "text-warning" : "text-text-muted"}`} dir="ltr">
               {expired ? translate("EXPIRED") : translate("Expires")} {new Date(apiKey.expiresAt).toLocaleDateString()}
             </p>
           )}
         </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
            isActive
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
        >
          <span className="material-symbols-outlined text-[13px]">{isActive ? "check_circle" : "pause_circle"}</span>
          {isActive ? translate("Active") : translate("Paused")}
        </span>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-border bg-surface-2/60 px-3 py-2.5">
          <p className="text-xs text-text-muted mb-1">{translate("Today")}</p>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary">token</span>
            <div>
              <p className="text-sm font-semibold text-text-main">{keyUsage.today.tokens.toLocaleString()}</p>
              <p className="text-[10px] text-text-muted">{translate("Tokens")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="material-symbols-outlined text-[16px] text-green-500">payments</span>
            <div>
              <p className="text-sm font-semibold text-text-main">${keyUsage.today.cost.toFixed(4)}</p>
              <p className="text-[10px] text-text-muted">{translate("Cost")}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface-2/60 px-3 py-2.5">
          <p className="text-xs text-text-muted mb-1">{translate("All Time")}</p>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary">token</span>
            <div>
              <p className="text-sm font-semibold text-text-main">{keyUsage.allTime.tokens.toLocaleString()}</p>
              <p className="text-[10px] text-text-muted">{translate("Tokens")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="material-symbols-outlined text-[16px] text-green-500">payments</span>
            <div>
              <p className="text-sm font-semibold text-text-main">${keyUsage.allTime.cost.toFixed(4)}</p>
              <p className="text-[10px] text-text-muted">{translate("Cost")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Permission badges */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(apiKey.scopes || []).map((s) => (
          <Badge key={s} icon="lock" label={s} tone="primary" />
        ))}
        {apiKey.usageLimitEnabled && (
          <Badge
            icon="payments"
            label={[
              apiKey.dailyUsageLimitUsd != null && `$${Number(apiKey.dailyUsageLimitUsd).toFixed(2)}/day`,
              apiKey.weeklyUsageLimitUsd != null && `$${Number(apiKey.weeklyUsageLimitUsd).toFixed(2)}/wk`,
            ].filter(Boolean).join(" · ")}
            tone="warning"
          />
        )}
        {apiKey.noLog && <Badge icon="visibility_off" label="noLog" tone="neutral" />}
        {apiKey.allowUsageCommand && <Badge icon="monitoring" label="usage cmd" tone="neutral" />}
        {apiKey.modelAccessMode === "restricted" && (
          <Badge icon="model_training" label={`models: ${(apiKey.allowedModels || []).join(", ") || "none"}`} tone="success" />
        )}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 mb-4">
        <code className="flex-1 min-w-0 text-sm font-mono text-text-main truncate">
          {apiKey.key}
        </code>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            onClick={onReveal}
            title="Reveal full key (copies it)"
            icon="key"
          />
          <IconButton
            onClick={onCopy}
            title={copied ? "Copied" : "Copy key"}
            icon={copied ? "check" : "content_copy"}
            active={copied}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">{isActive ? translate("Enabled") : translate("Disabled")}</span>
          <Toggle size="sm" checked={isActive} onChange={onToggleActive} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEditPermissions}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium text-text-muted hover:text-primary hover:bg-surface-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            {translate("Permissions")}
          </button>
          <button
            onClick={onRegenerate}
            title="Regenerate key"
            className="inline-flex items-center justify-center size-8 rounded-lg text-sm font-medium text-text-muted hover:text-primary hover:bg-surface-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium text-red-600 hover:bg-red-500/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            {translate("Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionsModal({ apiKey, groups, onClose, onSaved, onGroupsChanged }) {
  const [form, setForm] = useState({
    noLog: apiKey.noLog || false,
    allowUsageCommand: apiKey.allowUsageCommand || false,
    usageLimitEnabled: apiKey.usageLimitEnabled || false,
    dailyUsageLimitUsd: apiKey.dailyUsageLimitUsd ?? "",
    weeklyUsageLimitUsd: apiKey.weeklyUsageLimitUsd ?? "",
    modelAccessMode: apiKey.modelAccessMode === "restricted" ? "restricted" : "all",
    allowedModels: (apiKey.allowedModels || []).join(", "),
    groupId: "",
    expiresAt: apiKey.expiresAt ? String(apiKey.expiresAt).slice(0, 10) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setToggle = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        noLog: form.noLog,
        allowUsageCommand: form.allowUsageCommand,
        usageLimitEnabled: form.usageLimitEnabled,
        dailyUsageLimitUsd: form.dailyUsageLimitUsd === "" ? null : Number(form.dailyUsageLimitUsd),
        weeklyUsageLimitUsd: form.weeklyUsageLimitUsd === "" ? null : Number(form.weeklyUsageLimitUsd),
        modelAccessMode: form.modelAccessMode,
        allowedModels: parseModels(form.allowedModels),
        blockedModels: apiKey.blockedModels || [],
        expiresAt: form.expiresAt || null,
      };
      const res = await fetch(`/api/keys/${apiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save permissions");
        return;
      }
      if (form.groupId) {
        await fetch(`/api/keys/groups/${form.groupId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add-key", keyId: apiKey.id }),
        });
      }
      onSaved(data.key);
      onGroupsChanged();
    } catch (e) {
      setError("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${translate("Permissions")} — ${apiKey.name}`}>
      <div className="flex flex-col gap-5">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-text-main">{translate("Flags")}</h4>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-text-main">{translate("No logging")}</p>
              <p className="text-xs text-text-muted">{translate("Skip usage logging and spend tracking for this key.")}</p>
            </div>
            <Toggle size="sm" checked={form.noLog} onChange={setToggle("noLog")} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-text-main">{translate("Allow usage command")}</p>
              <p className="text-xs text-text-muted">{translate("Let this key query its own usage stats.")}</p>
            </div>
            <Toggle size="sm" checked={form.allowUsageCommand} onChange={setToggle("allowUsageCommand")} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-text-main">{translate("USD usage limits")}</h4>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
            <p className="text-sm font-medium text-text-main">{translate("Enable usage limits")}</p>
            <Toggle size="sm" checked={form.usageLimitEnabled} onChange={setToggle("usageLimitEnabled")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={translate("Daily limit (USD)")}
              type="number"
              min="0"
              step="0.01"
              value={form.dailyUsageLimitUsd}
              onChange={set("dailyUsageLimitUsd")}
              disabled={!form.usageLimitEnabled}
              placeholder="e.g. 5.00"
            />
            <Input
              label={translate("Weekly limit (USD)")}
              type="number"
              min="0"
              step="0.01"
              value={form.weeklyUsageLimitUsd}
              onChange={set("weeklyUsageLimitUsd")}
              disabled={!form.usageLimitEnabled}
              placeholder="e.g. 20.00"
            />
          </div>
          <p className="text-xs text-text-muted">
            {translate("When a limit is hit, the key is rejected with HTTP 429 until the window resets (daily at 00:00 UTC, weekly rolling 7d).")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-text-main">{translate("Model access")}</h4>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-text-main">{translate("Restrict to allowed models")}</p>
              <p className="text-xs text-text-muted">{translate("Off = all models allowed. On = only matching patterns below.")}</p>
            </div>
            <Toggle
              size="sm"
              checked={form.modelAccessMode === "restricted"}
              onChange={(v) => setForm((prev) => ({ ...prev, modelAccessMode: v ? "restricted" : "all" }))}
            />
          </div>
          <Input
            label={translate("Allowed model patterns")}
            value={form.allowedModels}
            onChange={set("allowedModels")}
            disabled={form.modelAccessMode !== "restricted"}
            placeholder="gpt-4*, claude-3-5-sonnet, gemini/*"
          />
          <Input
            type="date"
            label={translate("Expires at (optional)")}
            value={form.expiresAt}
            onChange={set("expiresAt")}
          />
        </div>
        {groups.length > 0 && (
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-text-main">{translate("Key groups")}</h4>
            <select
              value={form.groupId}
              onChange={set("groupId")}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{translate("No group")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted">
              {translate("Group rules (allow/deny) apply on top of allowed models. Add more groups from the section below.")}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} fullWidth disabled={saving}>
            {saving ? translate("Saving...") : translate("Save Permissions")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            {translate("Cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function KeyGroupsSection({ groups, onChanged }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [expanded, setExpanded] = useState(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/keys/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        setNewName("");
        setShowCreate(false);
        onChanged();
      }
    } catch (e) {
      console.log("Error creating key group:", e);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/keys/groups/${id}`, { method: "DELETE" });
      if (res.ok) onChanged();
    } catch (e) {
      console.log("Error deleting key group:", e);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-text-main">{translate("Key Groups")}</h2>
          <p className="text-sm text-text-muted">{translate("Organize keys and apply shared model allow/deny rules.")}</p>
        </div>
        <Button icon="add" size="sm" onClick={() => setShowCreate((v) => !v)}>
          {translate("New Group")}
        </Button>
      </div>

      {showCreate && (
        <div className="flex gap-2 mb-4">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={translate("Group name (e.g. internal-only)")}
          />
          <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-border bg-surface-2/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-text-main">{g.name}</p>
                <p className="text-xs text-text-muted truncate">{g.description || "—"} · {g.memberCount || 0} keys · {g.permissions?.length || 0} rules</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded((prev) => (prev === g.id ? null : g.id))}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium text-text-muted hover:text-primary hover:bg-surface-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">{expanded === g.id ? "expand_less" : "expand_more"}</span>
                  {expanded === g.id ? translate("Hide") : translate("Rules")}
                </button>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="inline-flex items-center justify-center size-8 rounded-lg text-sm font-medium text-red-600 hover:bg-red-500/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>

            {expanded === g.id && (
              <GroupRulesEditor
                group={g}
                onChanged={onChanged}
              />
            )}
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-text-muted text-center py-4">{translate("No groups yet.")}</p>
        )}
      </div>
    </div>
  );
}

function GroupRulesEditor({ group, onChanged }) {
  const [modelPattern, setModelPattern] = useState("");
  const [accessType, setAccessType] = useState("allow");

  const handleAddRule = async () => {
    if (!modelPattern.trim()) return;
    try {
      const res = await fetch(`/api/keys/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-permission", modelPattern: modelPattern.trim(), accessType }),
      });
      if (res.ok) {
        setModelPattern("");
        onChanged();
      }
    } catch (e) {
      console.log("Error adding group rule:", e);
    }
  };

  const handleRemoveRule = async (permissionId) => {
    try {
      const res = await fetch(`/api/keys/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-permission", permissionId }),
      });
      if (res.ok) onChanged();
    } catch (e) {
      console.log("Error removing group rule:", e);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={modelPattern}
          onChange={(e) => setModelPattern(e.target.value)}
            placeholder={translate("model pattern, e.g. gpt-4*")}
        />
        <select
          value={accessType}
          onChange={(e) => setAccessType(e.target.value)}
          className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="allow">{translate("Allow")}</option>
          <option value="deny">{translate("Deny")}</option>
        </select>
        <Button onClick={handleAddRule} disabled={!modelPattern.trim()}>Add</Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {(group.permissions || []).map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                label={p.accessType.toUpperCase()}
                tone={p.accessType === "allow" ? "success" : "warning"}
              />
              <code className="text-sm font-mono text-text-main truncate">{p.modelPattern}</code>
              {p.provider && <span className="text-xs text-text-muted">({p.provider})</span>}
            </div>
            <button
              onClick={() => handleRemoveRule(p.id)}
              className="inline-flex items-center justify-center size-7 rounded-lg text-red-600 hover:bg-red-500/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        ))}
        {(group.permissions || []).length === 0 && (
          <p className="text-xs text-text-muted">{translate("No rules yet. Deny rules override allow rules.")}</p>
        )}
      </div>
    </div>
  );
}

function IconButton({ onClick, title, icon, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex items-center justify-center size-8 rounded-lg transition-colors",
        active
          ? "text-green-600 bg-green-500/10"
          : "text-text-muted hover:text-primary hover:bg-surface-2"
      )}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}
