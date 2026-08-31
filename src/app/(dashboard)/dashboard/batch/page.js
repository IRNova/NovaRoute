"use client";

import { translate } from "@/i18n/runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardSkeleton,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Drawer,
} from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

const STATUS_META = {
  queued: { variant: "default", icon: "hourglass_empty", label: translate("Queued") },
  running: { variant: "primary", icon: "progress_activity", label: translate("Running") },
  completed: { variant: "success", icon: "check_circle", label: translate("Completed") },
  failed: { variant: "error", icon: "error", label: translate("Failed") },
  cancelled: { variant: "warning", icon: "cancel", label: translate("Cancelled") },
};

const FALLBACK_MODELS = [
  { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
  { value: "anthropic/claude-3-5-sonnet-20241022", label: "Anthropic Claude 3.5 Sonnet" },
  { value: "anthropic/claude-3-opus-20240229", label: "Anthropic Claude 3 Opus" },
  { value: "google/gemini-1.5-pro", label: "Google Gemini 1.5 Pro" },
  { value: "google/gemini-1.5-flash", label: "Google Gemini 1.5 Flash" },
  { value: "openrouter/openai/gpt-4o", label: "OpenRouter GPT-4o" },
];

const SAMPLE_JSONL = `{"custom_id":"request-1","method":"POST","url":"/v1/chat/completions","body":{"model":"openai/gpt-4o","messages":[{"role":"user","content":"What is 2+2?"}]}}
{"custom_id":"request-2","method":"POST","url":"/v1/chat/completions","body":{"model":"openai/gpt-4o","messages":[{"role":"user","content":"Say hello"}]}}
{"custom_id":"request-3","method":"POST","url":"/v1/chat/completions","body":{"model":"openai/gpt-4o","messages":[{"role":"user","content":"List three colors"}]}}`;

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatDuration(start, end) {
  if (!start) return "—";
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  const ms = Math.max(0, b - a);
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function statusVariant(status) {
  return STATUS_META[status]?.variant || "default";
}

function StatCard({ title, value, icon, variant = "default" }) {
  const variantClasses = {
    default: "text-text-main",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    error: "text-danger",
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

function ProgressBar({ value, status }) {
  const statusColor = {
    running: "bg-primary",
    completed: "bg-success",
    failed: "bg-danger",
    cancelled: "bg-warning",
    queued: "bg-text-muted",
  }[status] || "bg-text-muted";

  return (
    <div className="flex items-center gap-3 min-w-[140px]">
      <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full ${statusColor} transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs text-text-muted tabular-nums w-9">{value}%</span>
    </div>
  );
}

export default function BatchPage() {
  const notify = useNotificationStore();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [detailJob, setDetailJob] = useState(null);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [form, setForm] = useState({
    name: "",
    jsonl: "",
    model: "openai/gpt-4o",
    concurrency: 5,
    callbackUrl: "",
  });

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/batch");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      notify.error("Failed to load batch jobs");
    }
  }, [notify]);

  const fetchDetail = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/batch/${id}`);
      const data = await res.json();
      if (data.job) setDetailJob(data.job);
    } catch {
      // silently fail background refresh
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/batch").then((r) => r.json()),
      fetch("/api/models").then((r) => (r.ok ? r.json() : { models: [] })).catch(() => ({ models: [] })),
    ])
      .then(([jobsData, modelsData]) => {
        if (cancelled) return;
        setJobs(jobsData.jobs || []);
        const fetched = (modelsData.models || [])
          .filter((m) => m.routedModel)
          .map((m) => ({ value: m.routedModel, label: `${m.provider} / ${m.name || m.model}` }));
        if (fetched.length > 0) {
          setModels(fetched);
        }
      })
      .catch(() => notify.error("Failed to load batch jobs"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [notify]);

  // Poll for status updates while any job is running.
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "running");
    if (!hasRunning) return undefined;
    const interval = setInterval(() => {
      fetch("/api/batch")
        .then((r) => r.json())
        .then((data) => setJobs(data.jobs || []))
        .catch(() => {});
      if (detailJob?.status === "running") fetchDetail(detailJob.id);
    }, 1500);
    return () => clearInterval(interval);
  }, [jobs, detailJob, fetchDetail]);

  const stats = useMemo(() => {
    const running = jobs.filter((j) => j.status === "running").length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const queued = jobs.filter((j) => j.status === "queued").length;
    return { running, completed, failed, queued };
  }, [jobs]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      notify.error("Job name is required");
      return;
    }
    if (!form.model.trim()) {
      notify.error("Model is required");
      return;
    }

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(data.error || "Failed to create batch job");
        return;
      }
      notify.success("Batch job created");
      setShowCreate(false);
      setForm({ name: "", jsonl: "", model: "openai/gpt-4o", concurrency: 5, callbackUrl: "" });
      await fetchJobs();
      // Optionally auto-run the newly created job.
      if (data.job?.id) {
        await fetch(`/api/batch/${data.job.id}/run`, { method: "POST" });
        await fetchJobs();
      }
    } catch {
      notify.error("Failed to create batch job");
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setForm((prev) => ({ ...prev, jsonl: String(e.target?.result || "") }));
    };
    reader.readAsText(file);
  };

  const performAction = async (id, action) => {
    setActionLoading((prev) => ({ ...prev, [`${id}:${action}`]: true }));
    try {
      const res = await fetch(`/api/batch/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error(data.error || `Failed to ${action} job`);
        return;
      }
      const actionLabels = { run: "started", retry: "retried", cancel: "cancelled" };
      notify.success(`Job ${actionLabels[action] || action}`);
      await fetchJobs();
      if (detailJob?.id === id && data.job) setDetailJob(data.job);
    } catch {
      notify.error(`Failed to ${action} job`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${id}:${action}`]: false }));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this batch job? This cannot be undone.")) return;
    setActionLoading((prev) => ({ ...prev, [`${id}:delete`]: true }));
    try {
      const res = await fetch(`/api/batch/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify.error(data.error || "Failed to delete job");
        return;
      }
      notify.success("Job deleted");
      setJobs((prev) => prev.filter((j) => j.id !== id));
      if (detailJob?.id === id) setDetailJob(null);
    } catch {
      notify.error("Failed to delete job");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${id}:delete`]: false }));
    }
  };

  const openDetail = async (job) => {
    setDetailJob(job);
    await fetchDetail(job.id);
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
              <h1 className="text-2xl font-bold text-text-main">{translate("Batch Jobs")}</h1>
              <p className="text-sm text-text-muted mt-1">
                Upload JSONL request sets, run them concurrently, and inspect results.
              </p>
            </div>
            <Button icon="add" onClick={() => setShowCreate(true)}>
              New Batch
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Running" value={stats.running} icon="progress_activity" variant="primary" />
            <StatCard title="Completed" value={stats.completed} icon="check_circle" variant="success" />
            <StatCard title="Failed" value={stats.failed} icon="error" variant="error" />
            <StatCard title="Queued" value={stats.queued} icon="hourglass_empty" variant="default" />
          </div>

          {/* Jobs table */}
          {jobs.length === 0 ? (
            <Card className="p-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">batch_prediction</span>
              <p className="text-sm text-text-muted">{translate("No batch jobs yet. Create one to process multiple requests.")}</p>
              <Button className="mt-4" icon="add" onClick={() => setShowCreate(true)}>
                New Batch
              </Button>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-2 text-text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Progress</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Completed</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {jobs.map((job) => {
                      const meta = STATUS_META[job.status] || STATUS_META.queued;
                      return (
                        <tr key={job.id} className="hover:bg-surface-2/30 transition-colors">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openDetail(job)}
                              className="text-left font-medium text-text-main hover:text-primary"
                            >
                              {job.name}
                            </button>
                            <p className="text-xs text-text-muted">{job.total || 0} items</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(job.status)} size="sm" icon={meta.icon}>
                              {meta.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <ProgressBar value={job.progress || 0} status={job.status} />
                          </td>
                          <td className="px-4 py-3 text-text-muted">{job.model || "—"}</td>
                          <td className="px-4 py-3 text-text-muted">{formatDateTime(job.createdAt)}</td>
                          <td className="px-4 py-3 text-text-muted">{formatDateTime(job.completedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {job.status === "queued" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon="play_arrow"
                                  onClick={() => performAction(job.id, "run")}
                                  loading={actionLoading[`${job.id}:run`]}
                                />
                              )}
                              {job.status === "running" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon="stop"
                                  onClick={() => performAction(job.id, "cancel")}
                                  loading={actionLoading[`${job.id}:cancel`]}
                                />
                              )}
                              {job.status === "failed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon="replay"
                                  onClick={() => performAction(job.id, "retry")}
                                  loading={actionLoading[`${job.id}:retry`]}
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="visibility"
                                onClick={() => openDetail(job)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="delete"
                                onClick={() => handleDelete(job.id)}
                                loading={actionLoading[`${job.id}:delete`]}
                                className="text-danger hover:text-danger"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar help */}
        <div className="xl:col-span-3">
          <Card title={translate("How batch jobs work")} icon="help" className="p-5 sticky top-6">
            <div className="space-y-4 mt-2">
              {[
                { icon: "upload_file", title: "Upload or paste JSONL", text: "Each line must include custom_id, method, url, and body." },
                { icon: "tune", title: "Configure", text: "Pick a model, set concurrency, and optionally add a callback URL." },
                { icon: "play_arrow", title: "Run", text: "NovaRoute processes items in parallel and updates progress live." },
                { icon: "visibility", title: "Inspect", text: "Open a job to see per-item responses, errors, and logs." },
              ].map((step, idx) => (
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
              <p className="text-xs font-medium text-text-main mb-2">Expected JSONL shape</p>
              <code className="block text-[11px] bg-surface-2 rounded-lg px-3 py-2 text-text-muted whitespace-pre-wrap">
                {`{"custom_id":"req-1","method":"POST","url":"/v1/chat/completions","body":{...}}`}
              </code>
            </div>
          </Card>
        </div>
      </div>

      {/* Create batch modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={translate("New Batch Job")}
        size="full"
      >
        <div className="flex flex-col gap-5">
          <Input
            label={translate("Job name")}
            placeholder="e.g., Weekly content generation"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />

          <Select
            label="Model"
            options={models}
            value={form.model}
            onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={translate("Concurrency")}
              type="number"
              min={1}
              max={50}
              value={form.concurrency}
              onChange={(e) => setForm((prev) => ({ ...prev, concurrency: parseInt(e.target.value, 10) || 1 }))}
              hint="Items processed in parallel"
            />
            <Input
              label={translate("Callback URL (optional)")}
              placeholder="https://hooks.example.com/batch"
              value={form.callbackUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, callbackUrl: e.target.value }))}
              hint="Called when the job finishes"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-main">Requests (JSONL)</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon="auto_fix_high"
                  onClick={() => setForm((prev) => ({ ...prev, jsonl: SAMPLE_JSONL }))}
                >
                  Load sample
                </Button>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".jsonl,.json,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <span className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-semibold rounded-[8px] bg-surface-2 hover:bg-surface-3 text-text-main transition-colors">
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    Upload file
                  </span>
                </label>
              </div>
            </div>
            <textarea
              value={form.jsonl}
              onChange={(e) => setForm((prev) => ({ ...prev, jsonl: e.target.value }))}
              rows={10}
              placeholder={`{"custom_id":"req-1","method":"POST","url":"/v1/chat/completions","body":{"model":"openai/gpt-4o","messages":[{"role":"user","content":"Hello"}]}}`}
              className="w-full p-3 text-sm text-text-main bg-surface-2 border border-transparent rounded-[10px] placeholder-text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/40 resize-y font-mono"
            />
            <p className="text-xs text-text-muted">
              One JSON object per line. Each object must include a unique <code>custom_id</code>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleCreate}
              disabled={!form.name.trim() || !form.model.trim()}
              className="sm:flex-1"
            >
              Create & Run
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="sm:flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Job detail drawer */}
      <Drawer
        isOpen={!!detailJob}
        onClose={() => setDetailJob(null)}
        title={detailJob?.name || "Job details"}
        width="xl"
      >
        {detailJob && (
          <div className="flex flex-col gap-6">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card.Section className="text-center">
                <p className="text-xs text-text-muted uppercase">Status</p>
                <Badge variant={statusVariant(detailJob.status)} size="sm" className="mt-1">
                  {STATUS_META[detailJob.status]?.label || detailJob.status}
                </Badge>
              </Card.Section>
              <Card.Section className="text-center">
                <p className="text-xs text-text-muted uppercase">Progress</p>
                <p className="text-lg font-bold text-text-main mt-1">{detailJob.progress || 0}%</p>
              </Card.Section>
              <Card.Section className="text-center">
                <p className="text-xs text-text-muted uppercase">Succeeded</p>
                <p className="text-lg font-bold text-success mt-1">{detailJob.succeeded || 0}</p>
              </Card.Section>
              <Card.Section className="text-center">
                <p className="text-xs text-text-muted uppercase">Failed</p>
                <p className="text-lg font-bold text-danger mt-1">{detailJob.failed || 0}</p>
              </Card.Section>
            </div>

            <div className="space-y-1 text-sm text-text-muted">
              <p><span className="font-medium text-text-main">Model:</span> {detailJob.model || "—"}</p>
              <p><span className="font-medium text-text-main">Concurrency:</span> {detailJob.concurrency || "—"}</p>
              <p><span className="font-medium text-text-main">Callback URL:</span> {detailJob.callbackUrl || "—"}</p>
              <p><span className="font-medium text-text-main">Created:</span> {formatDateTime(detailJob.createdAt)}</p>
              <p><span className="font-medium text-text-main">Duration:</span> {formatDuration(detailJob.createdAt, detailJob.completedAt)}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {detailJob.status === "queued" && (
                <Button
                  size="sm"
                  icon="play_arrow"
                  onClick={() => performAction(detailJob.id, "run")}
                  loading={actionLoading[`${detailJob.id}:run`]}
                >
                  Run
                </Button>
              )}
              {detailJob.status === "running" && (
                <Button
                  size="sm"
                  variant="danger"
                  icon="stop"
                  onClick={() => performAction(detailJob.id, "cancel")}
                  loading={actionLoading[`${detailJob.id}:cancel`]}
                >
                  Cancel
                </Button>
              )}
              {detailJob.status === "failed" && (
                <Button
                  size="sm"
                  icon="replay"
                  onClick={() => performAction(detailJob.id, "retry")}
                  loading={actionLoading[`${detailJob.id}:retry`]}
                >
                  Retry failed
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                icon="delete"
                onClick={() => handleDelete(detailJob.id)}
                loading={actionLoading[`${detailJob.id}:delete`]}
              >
                Delete
              </Button>
            </div>

            {/* Items */}
            <div>
              <h3 className="text-sm font-semibold text-text-main mb-3">Items</h3>
              {detailJob.items?.length === 0 ? (
                <p className="text-sm text-text-muted">No items.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
                  {detailJob.items?.map((item) => (
                    <div
                      key={item.customId}
                      className="rounded-[10px] border border-border-subtle bg-surface-2 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <code className="text-xs text-text-main">{item.customId}</code>
                        <Badge
                          variant={item.status === "succeeded" ? "success" : item.status === "failed" ? "error" : item.status === "running" ? "primary" : "default"}
                          size="sm"
                        >
                          {item.status}
                        </Badge>
                      </div>
                      {item.error && (
                        <p className="text-xs text-danger mt-2">{item.error}</p>
                      )}
                      {item.response && (
                        <pre className="mt-2 text-[11px] text-text-muted bg-bg p-2 rounded-lg overflow-x-auto">
                          {JSON.stringify(item.response, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logs */}
            <div>
              <h3 className="text-sm font-semibold text-text-main mb-3">Logs</h3>
              {detailJob.logs?.length === 0 ? (
                <p className="text-sm text-text-muted">No logs yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[30vh] overflow-y-auto pr-1">
                  {detailJob.logs?.map((log, idx) => (
                    <div key={idx} className="flex gap-3 text-xs">
                      <span className="text-text-muted tabular-nums shrink-0">{formatDateTime(log.at)}</span>
                      <span
                        className={`shrink-0 font-semibold uppercase ${
                          log.level === "error"
                            ? "text-danger"
                            : log.level === "warning"
                              ? "text-warning"
                              : "text-primary"
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-text-main">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
