/**
 * Batch job store — lightweight file-backed in-memory registry for the
 * dashboard batch-processing UI. Serves as the backing store for the
 * /api/batch stub handlers.
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/dataDir.js";

const STORE_FILE = path.join(DATA_DIR, "batch-jobs.json");

/** @type {Map<string, any>} */
let jobs = new Map();
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          jobs = new Map(parsed.map((j) => [j.id, j]));
        }
      }
    }
  } catch (error) {
    console.log("[batchStore] failed to load jobs:", error);
  }
  loaded = true;
}

function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(Array.from(jobs.values()), null, 2));
  } catch (error) {
    console.log("[batchStore] failed to persist jobs:", error);
  }
}

function generateId() {
  return `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

export function listJobs() {
  ensureLoaded();
  return Array.from(jobs.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getJob(id) {
  ensureLoaded();
  return jobs.get(id) || null;
}

function validateJsonl(lines) {
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (!parsed.custom_id) {
        return { ok: false, error: `Line ${i + 1} is missing custom_id` };
      }
      items.push(parsed);
    } catch {
      return { ok: false, error: `Line ${i + 1} is not valid JSON` };
    }
  }
  return { ok: true, items };
}

export function createJob(input) {
  ensureLoaded();

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const model = typeof input.model === "string" ? input.model.trim() : "";
  const concurrency = Math.max(1, Math.min(50, parseInt(input.concurrency, 10) || 5));
  const callbackUrl = typeof input.callbackUrl === "string" ? input.callbackUrl.trim() : "";

  let items = [];
  let source = "jsonl";

  // Legacy compatibility: the old page created jobs with count + prompt.
  if (input.prompt && typeof input.prompt === "string" && !input.jsonl) {
    const count = Math.max(1, Math.min(1000, parseInt(input.count, 10) || 1));
    items = Array.from({ length: count }, (_, i) => ({
      custom_id: `legacy_${i + 1}`,
      method: "POST",
      url: "/v1/chat/completions",
      body: {
        model,
        messages: [{ role: "user", content: input.prompt.replace(/\{\{index\}\}/g, String(i + 1)) }],
      },
    }));
    source = "legacy";
  } else {
    const jsonl = typeof input.jsonl === "string" ? input.jsonl : "";
    const lines = jsonl.split(/\r?\n/);
    const validated = validateJsonl(lines);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    items = validated.items;
  }

  if (items.length === 0) {
    return { ok: false, error: "No valid batch items provided" };
  }

  const id = generateId();
  const job = {
    id,
    name: name || `Batch ${id.slice(-8)}`,
    model,
    concurrency,
    callbackUrl,
    source,
    status: "queued",
    progress: 0,
    total: items.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    items: items.map((it) => ({
      customId: String(it.custom_id),
      method: it.method || "POST",
      url: it.url || "/v1/chat/completions",
      body: it.body || {},
      status: "pending",
      response: null,
      error: null,
      attempts: 0,
    })),
    logs: [{ at: now(), level: "info", message: `Created with ${items.length} items` }],
    createdAt: now(),
    completedAt: null,
  };

  jobs.set(id, job);
  persist();
  return { ok: true, job };
}

function addLog(job, level, message) {
  job.logs = job.logs || [];
  job.logs.push({ at: now(), level, message });
  if (job.logs.length > 200) job.logs = job.logs.slice(-200);
}

function recalcProgress(job) {
  const total = job.total || job.items.length || 1;
  const processed = job.items.filter((it) => it.status !== "pending" && it.status !== "running").length;
  job.processed = processed;
  job.succeeded = job.items.filter((it) => it.status === "succeeded").length;
  job.failed = job.items.filter((it) => it.status === "failed").length;
  job.progress = Math.round((processed / total) * 100);

  if (job.processed === total && job.status === "running") {
    job.status = job.failed > 0 ? "failed" : "completed";
    job.completedAt = now();
    addLog(job, job.failed > 0 ? "warning" : "info", `Finished — ${job.succeeded} succeeded, ${job.failed} failed`);
  }
}

async function simulateItem(item, model, job) {
  item.status = "running";
  // Deterministic fake latency based on custom_id length so retries behave similarly.
  const latency = 300 + (item.customId.length % 7) * 120;
  await new Promise((resolve) => { setTimeout(resolve, latency); });

  // Fail ~10% of items deterministically to make retry meaningful.
  const shouldFail = item.customId.charCodeAt(item.customId.length - 1) % 10 === 0 && item.attempts === 0;
  if (shouldFail) {
    item.status = "failed";
    item.error = "Simulated upstream failure (HTTP 503)";
    item.attempts += 1;
    addLog(job, "error", `Item ${item.customId} failed: ${item.error}`);
  } else {
    item.status = "succeeded";
    item.response = {
      model,
      choices: [{ index: 0, message: { role: "assistant", content: `Simulated completion for ${item.customId}` } }],
    };
    item.attempts += 1;
    addLog(job, "info", `Item ${item.customId} completed`);
  }
}

async function drainJob(job) {
  const pending = job.items.filter((it) => it.status === "pending");
  const queue = [...pending];

  addLog(job, "info", `Started processing ${pending.length} items with concurrency ${job.concurrency}`);

  async function worker() {
    while (job.status === "running" && queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        await simulateItem(item, job.model, job);
      } catch (error) {
        item.status = "failed";
        item.error = error?.message || "Unknown error";
        addLog(job, "error", `Item ${item.customId} error: ${item.error}`);
      }
      recalcProgress(job);
      persist();
    }
  }

  const workers = Array.from({ length: job.concurrency }, () => worker());
  await Promise.all(workers);

  if (job.status === "running") {
    recalcProgress(job);
    persist();
  }
}

export async function runJob(id) {
  ensureLoaded();
  const job = jobs.get(id);
  if (!job) return { ok: false, error: "Job not found" };
  if (job.status === "running") return { ok: false, error: "Job already running" };

  // Reset pending/running items from a previous partial run.
  for (const it of job.items) {
    if (it.status === "running") it.status = "pending";
  }

  job.status = "running";
  job.completedAt = null;
  addLog(job, "info", "Job started");
  recalcProgress(job);
  persist();

  // Intentionally non-blocking: the POST returns immediately and the job runs in the background.
  drainJob(job).catch((error) => {
    job.status = "failed";
    job.completedAt = now();
    addLog(job, "error", `Job crashed: ${error.message || error}`);
    persist();
  });

  return { ok: true, job };
}

export async function retryJob(id) {
  ensureLoaded();
  const job = jobs.get(id);
  if (!job) return { ok: false, error: "Job not found" };

  const failedItems = job.items.filter((it) => it.status === "failed");
  if (failedItems.length === 0) return { ok: false, error: "No failed items to retry" };

  for (const it of failedItems) {
    it.status = "pending";
    it.error = null;
    it.response = null;
  }

  job.status = "running";
  job.completedAt = null;
  addLog(job, "info", `Retrying ${failedItems.length} failed items`);
  recalcProgress(job);
  persist();

  drainJob(job).catch((error) => {
    job.status = "failed";
    job.completedAt = now();
    addLog(job, "error", `Job crashed: ${error.message || error}`);
    persist();
  });

  return { ok: true, job };
}

export function cancelJob(id) {
  ensureLoaded();
  const job = jobs.get(id);
  if (!job) return { ok: false, error: "Job not found" };
  if (job.status !== "running") return { ok: false, error: "Job is not running" };

  job.status = "cancelled";
  job.completedAt = now();
  addLog(job, "warning", "Job cancelled by user");
  recalcProgress(job);
  persist();
  return { ok: true, job };
}

export function deleteJob(id) {
  ensureLoaded();
  const existed = jobs.delete(id);
  if (!existed) return { ok: false, error: "Job not found" };
  persist();
  return { ok: true };
}
