"use client";

import { translate } from "@/i18n/runtime";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardSkeleton,
  Button,
  Badge,
  Input,
  Toggle,
  Select,
  Modal,
} from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

const EVENT_OPTIONS = [
  { value: "request.completed", label: translate("Request completed") },
  { value: "request.failed", label: translate("Request failed") },
  { value: "error.5xx", label: translate("5xx error") },
  { value: "provider.failover", label: translate("Provider failover") },
  { value: "account.token_expired", label: translate("Token expired") },
  { value: "quota.warning", label: translate("Quota warning") },
  { value: "usage.threshold", label: translate("Usage threshold") },
];

const METHOD_OPTIONS = [
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
];

const HOW_IT_WORKS_STEPS = [
  { icon: "add_link", title: translate("Add an endpoint"), text: "Paste the HTTPS URL that should receive NovaRoute events." },
  { icon: "checklist", title: translate("Pick events"), text: "Choose which events should trigger deliveries to this endpoint." },
  { icon: "vpn_key", title: translate("Secure with a secret"), text: "Optionally set a secret to verify webhook signatures (HMAC-SHA256)." },
  { icon: "send", title: translate("Test & enable"), text: "Send a test payload, then activate the webhook." },
];

function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

function StatusDot({ active }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${active ? "bg-success" : "bg-text-muted"}`}
      aria-hidden="true"
    />
  );
}

function StatCard({ title, value, icon, variant = "default" }) {
  const variantClasses = {
    default: "text-text-main",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${variantClasses[variant] || variantClasses.default}`}>
            {value}
          </p>
        </div>
        <div className="p-2 rounded-[10px] bg-surface-2 text-text-muted">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
    </Card>
  );
}

export default function WebhooksPage() {
  const notify = useNotificationStore();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    url: "",
    secret: "",
    events: [],
    active: true,
    method: "POST",
  });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchWebhooks = async () => {
    try {
      const res = await fetch("/api/webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch {
      notify.error("Failed to load webhooks");
    }
  };

  useEffect(() => {
    fetch("/api/webhooks")
      .then((res) => res.json())
      .then((data) => setWebhooks(data.webhooks || []))
      .catch(() => notify.error("Failed to load webhooks"))
      .finally(() => setLoading(false));
  }, [notify]);

  const stats = useMemo(() => {
    const active = webhooks.filter((w) => w.active).length;
    const deliveries = webhooks.reduce((sum, w) => sum + (w.deliveryCount || 0), 0);
    const failures = webhooks.reduce((sum, w) => sum + (w.failureCount || 0), 0);
    const successRate = deliveries > 0 ? Math.round(((deliveries - failures) / deliveries) * 100) : 100;
    return { active, deliveries, failures, successRate };
  }, [webhooks]);

  const openCreate = () => {
    setEditing(null);
    setForm({ url: "", secret: "", events: [], active: true, method: "POST" });
    setTestResult(null);
    setShowModal(true);
  };

  const openEdit = (wh) => {
    setEditing(wh);
    setForm({
      url: wh.url || "",
      secret: wh.secret || "",
      events: Array.isArray(wh.events) ? wh.events : [],
      active: wh.active !== false,
      method: wh.method || "POST",
    });
    setTestResult(null);
    setShowModal(true);
  };

  const toggleEvent = (value) => {
    setForm((prev) => {
      const has = prev.events.includes(value);
      return {
        ...prev,
        events: has ? prev.events.filter((e) => e !== value) : [...prev.events, value],
      };
    });
  };

  const handleSave = async () => {
    if (!form.url.trim()) {
      notify.error("Webhook URL is required");
      return;
    }
    if (form.events.length === 0) {
      notify.error("Select at least one event");
      return;
    }

    setSaving(true);
    const payload = {
      url: form.url.trim(),
      events: form.events,
      secret: form.secret,
      active: form.active,
      method: form.method,
    };

    try {
      const res = editing
        ? await fetch(`/api/webhooks/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/webhooks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify.error(data.error || "Failed to save webhook");
        return;
      }

      notify.success(editing ? "Webhook updated" : "Webhook created");
      await fetchWebhooks();
      setShowModal(false);
    } catch {
      notify.error("Failed to save webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (whId) => {
    if (!confirm("Delete this webhook?")) return;
    try {
      const res = await fetch(`/api/webhooks/${whId}`, { method: "DELETE" });
      if (!res.ok) {
        notify.error("Failed to delete webhook");
        return;
      }
      setWebhooks((prev) => prev.filter((w) => w.id !== whId));
      notify.success("Webhook deleted");
    } catch {
      notify.error("Failed to delete webhook");
    }
  };

  const handleToggleActive = async (wh) => {
    const next = !wh.active;
    setWebhooks((prev) =>
      prev.map((w) => (w.id === wh.id ? { ...w, active: next } : w))
    );
    try {
      const res = await fetch(`/api/webhooks/${wh.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error("update failed");
    } catch {
      setWebhooks((prev) =>
        prev.map((w) => (w.id === wh.id ? { ...w, active: !next } : w))
      );
      notify.error("Failed to update webhook status");
    }
  };

  const handleTestWebhook = async (whId) => {
    setTestingId(whId);
    try {
      const res = await fetch(`/api/webhooks/${whId}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        notify.success(`Webhook test delivered · HTTP ${data.status}`);
      } else {
        notify.error(`Webhook test failed · HTTP ${data.status} ${data.statusText || ""}`);
      }
      await fetchWebhooks();
    } catch {
      notify.error("Failed to test webhook");
    } finally {
      setTestingId(null);
    }
  };

  const handleTestEndpoint = async () => {
    if (!form.url.trim()) {
      notify.error("Enter a URL to test");
      return;
    }
    setTestingEndpoint(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: form.url.trim(),
          secret: form.secret,
          method: form.method,
          event: "webhook.test",
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        notify.success(`Endpoint reachable · HTTP ${data.status}`);
      } else {
        notify.error(`Endpoint test failed · HTTP ${data.status} ${data.statusText || ""}`);
      }
    } catch {
      notify.error("Failed to test endpoint");
      setTestResult({ success: false, status: 0, statusText: "Network error" });
    } finally {
      setTestingEndpoint(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main content */}
        <div className="xl:col-span-9 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text-main">{translate("Webhooks")}</h1>
              <p className="text-sm text-text-muted mt-1">
                Configure webhook endpoints for real-time event notifications.
              </p>
            </div>
            <Button icon="add" onClick={openCreate}>
              Add Webhook
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Active webhooks" value={stats.active} icon="webhook" />
            <StatCard title="Deliveries" value={stats.deliveries.toLocaleString()} icon="send" />
            <StatCard title="Success rate" value={`${stats.successRate}%`} icon="check_circle" variant="success" />
            <StatCard title="Failures" value={stats.failures.toLocaleString()} icon="error" variant={stats.failures > 0 ? "danger" : "default"} />
          </div>

          {/* List / table */}
          {webhooks.length === 0 ? (
            <Card className="p-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">webhook</span>
              <p className="text-sm text-text-muted">No webhooks configured. Add one to receive event notifications.</p>
              <Button className="mt-4" icon="add" onClick={openCreate}>
                Add Webhook
              </Button>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-2 text-text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Endpoint</th>
                      <th className="px-4 py-3 font-medium">Events</th>
                      <th className="px-4 py-3 font-medium">Last delivery</th>
                      <th className="px-4 py-3 font-medium">Retries</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {webhooks.map((wh) => (
                      <tr key={wh.id} className="hover:bg-surface-2/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusDot active={wh.active} />
                            <Badge variant={wh.active ? "success" : "default"} size="sm">
                              {wh.active ? "active" : "inactive"}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono text-text-main truncate max-w-[240px]">{wh.url}</span>
                            <span className="text-[11px] text-text-muted">{wh.method || "POST"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(wh.events || []).slice(0, 3).map((ev) => (
                              <Badge key={ev} variant="default" size="sm">{ev}</Badge>
                            ))}
                            {(wh.events || []).length > 3 && (
                              <Badge variant="default" size="sm">+{(wh.events || []).length - 3}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-text-main">{formatDateTime(wh.lastDelivery)}</span>
                            {wh.lastStatus && (
                              <Badge
                                variant={wh.lastStatus === "success" ? "success" : "error"}
                                size="sm"
                                className="w-fit mt-0.5"
                              >
                                {wh.lastStatus}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-main">{wh.retryCount || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Toggle
                              checked={wh.active}
                              onChange={() => handleToggleActive(wh)}
                              aria-label={`Toggle ${wh.url}`}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="send"
                              onClick={() => handleTestWebhook(wh.id)}
                              loading={testingId === wh.id}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="edit"
                              onClick={() => openEdit(wh)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="delete"
                              onClick={() => handleDelete(wh.id)}
                              className="text-danger hover:text-danger"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* How it works sidebar */}
        <div className="xl:col-span-3">
          <Card title={translate("How webhooks work")} icon="help" className="p-5 sticky top-6">
            <div className="space-y-4 mt-2">
              {HOW_IT_WORKS_STEPS.map((step, idx) => (
                <div key={step.title} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center text-xs font-semibold text-text-muted">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-text-main">
                      <span className="material-symbols-outlined text-[16px] text-text-muted">{step.icon}</span>
                      {step.title}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-border-subtle">
              <p className="text-xs font-medium text-text-main mb-2">Signature header</p>
              <code className="block text-[11px] bg-surface-2 rounded-lg px-3 py-2 text-text-muted">
                X-Webhook-Signature: sha256=&lt;hmac&gt;
              </code>
              <p className="text-[11px] text-text-muted mt-2">
                Payloads are signed with HMAC-SHA256 when a secret is set.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Add/Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Webhook" : "Add Webhook"}
        size="lg"
      >
        <div className="flex flex-col gap-5">
          <Input
            label={translate("Webhook URL")}
            placeholder="https://hooks.example.com/your-webhook"
            value={form.url}
            onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={translate("HTTP method")}
              options={METHOD_OPTIONS}
              value={form.method}
              onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value }))}
            />
            <Input
              label={translate("Secret (optional)")}
              type="password"
              placeholder="Used to sign payloads"
              value={form.secret}
              onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))}
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={testingEndpoint ? "progress_activity" : "send"
            }
            onClick={handleTestEndpoint}
            disabled={testingEndpoint || !form.url.trim()}
            loading={testingEndpoint}
          >
            Test endpoint
          </Button>

          {testResult && (
            <div className={`text-xs flex items-center gap-2 rounded-lg px-3 py-2 ${testResult.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
              <span className="material-symbols-outlined text-[16px]">
                {testResult.success ? "check_circle" : "error"}
              </span>
              {testResult.success
                ? `Endpoint reachable · HTTP ${testResult.status}`
                : `Endpoint unreachable · HTTP ${testResult.status} ${testResult.statusText || ""}`}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-text-main block mb-2">Events</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENT_OPTIONS.map((ev) => {
                const checked = form.events.includes(ev.value);
                return (
                  <label
                    key={ev.value}
                    className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2 cursor-pointer transition-colors ${
                      checked
                        ? "border-brand-500/40 bg-brand-500/5"
                        : "border-border-subtle bg-surface-2 hover:border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border-subtle text-brand-500 focus:ring-brand-500/30"
                      checked={checked}
                      onChange={() => toggleEvent(ev.value)}
                    />
                    <span className="text-sm text-text-main">{ev.label}</span>
                  </label>
                );
              })}
            </div>
            {form.events.length === 0 && (
              <p className="text-xs text-danger mt-2">Select at least one event.</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-3">
            <div>
              <p className="text-sm font-medium text-text-main">Active</p>
              <p className="text-xs text-text-muted">Deliver events to this endpoint.</p>
            </div>
            <Toggle
              checked={form.active}
              onChange={(next) => setForm((prev) => ({ ...prev, active: next }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !form.url.trim() || form.events.length === 0} loading={saving}>
              {editing ? translate("Save Changes") : translate("Create Webhook")}
            </Button>
            <Button variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
