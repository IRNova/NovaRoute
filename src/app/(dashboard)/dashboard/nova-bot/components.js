"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { translate } from "@/i18n/runtime";
import { getModelsByProviderId } from "@/shared/constants/models";
import {
  AI_PROVIDERS,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
} from "@/shared/constants/providers";

export const ROLE_META = {
  ceo: { label: "CEO", icon: "workspace_premium", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  supervisor: { label: "Supervisor", icon: "verified_user", className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  employee: { label: "Employee", icon: "badge", className: "bg-primary/10 text-primary" },
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-rose-500", "bg-orange-500",
  "bg-cyan-500", "bg-pink-500", "bg-lime-600", "bg-indigo-500",
];

export function colorForAgent(agent, index = 0) {
  if (agent?.role === "ceo") return "bg-amber-500";
  if (agent?.role === "supervisor") return "bg-violet-500";
  if (agent?.color) return agent.color;
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function AgentAvatar({ agent, index = 0, size = "md" }) {
  const sizeClass = size === "sm" ? "size-7 text-[12px]" : size === "lg" ? "size-11 text-[18px]" : "size-9 text-[14px]";
  const initial = (agent?.name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className={cn("rounded-full flex items-center justify-center shrink-0 font-bold text-white shadow-sm", colorForAgent(agent, index), sizeClass)}>
      {initial}
    </div>
  );
}

export function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.employee;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.className)}>
      <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
      {translate(meta.label)}
    </span>
  );
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ---------------- Timeline items ---------------- */

export function UserMessage({ message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-on-primary px-4 py-3 text-[15px] leading-7 whitespace-pre-wrap break-words" dir="auto">
        {message.content}
      </div>
    </div>
  );
}

export function AgentMessage({ message, agentsById }) {
  const agent = message.agentId ? agentsById[message.agentId] : null;
  const isCeo = message.agentRole === "ceo";
  const isError = message.type === "error";
  const isPlan = message.type === "plan";

  if (message.type === "review") {
    const verdict = message.meta?.verdict;
    const flagged = verdict === "flagged";
    const phrase = flagged
      ? translate("flagged the work of {name}").replace("{name}", message.meta?.targetName || "")
      : translate("approved the work of {name}").replace("{name}", message.meta?.targetName || "");
    return (
      <div className="flex justify-center">
        <div className={cn(
          "inline-flex items-start gap-2 max-w-[90%] rounded-xl border px-3 py-2 text-xs leading-6",
          flagged
            ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        )}>
          <span className="material-symbols-outlined text-[16px] mt-0.5">{flagged ? "flag" : "verified"}</span>
          <div dir="auto">
            <span className="font-semibold">{message.agentName}</span>{" "}
            <span className="opacity-80">{phrase}:</span>{" "}
            <span dir="auto">{message.content}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isCeo && "flex-col sm:flex-row")}>
      <AgentAvatar agent={agent || { name: message.agentName, role: message.agentRole }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-semibold text-text-main" dir="auto">{message.agentName}</span>
          <RoleBadge role={message.agentRole} />
          {isPlan && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">account_tree</span>
              {translate("Plan")}
            </span>
          )}
        </div>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-[15px] leading-7 whitespace-pre-wrap break-words border",
          isError
            ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 rounded-tl-sm"
            : isPlan
              ? "border-amber-500/25 bg-amber-500/5 text-text-main rounded-tl-sm"
              : isCeo
                ? "border-primary/25 bg-primary/5 text-text-main rounded-tl-sm"
                : "border-border bg-surface text-text-main rounded-tl-sm"
        )} dir="auto">
          {message.content}
          {isPlan && Array.isArray(message.meta?.tasks) && message.meta.tasks.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-border pt-2.5">
              {message.meta.tasks.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-text-muted">
                  <span className="material-symbols-outlined text-[14px] mt-0.5 text-amber-500">arrow_circle_right</span>
                  <span><b className="text-text-main" dir="auto">{t.agentName}</b>  <span dir="auto">{t.instruction}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const TASK_STATUS_META = {
  pending: { icon: "schedule", label: "Pending", className: "text-text-muted bg-surface-2" },
  running: { icon: "progress_activity", label: "Working", className: "text-blue-600 dark:text-blue-400 bg-blue-500/10 animate-pulse" },
  done: { icon: "check_circle", label: "Done", className: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  failed: { icon: "error", label: "Failed", className: "text-red-600 dark:text-red-400 bg-red-500/10" },
};

export function TaskCard({ task, agentsById }) {
  const [open, setOpen] = useState(false);
  const status = TASK_STATUS_META[task.status] || TASK_STATUS_META.pending;
  const employee = task.toAgentId ? agentsById[task.toAgentId] : { name: task.toAgentName };
  const hasResult = !!task.result;

  return (
    <div className="ms-6 sm:ms-12 rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-surface-2/40 flex-wrap">
        <span className="material-symbols-outlined text-[16px] text-amber-500">assignment</span>
        <span className="text-xs font-semibold text-text-main" dir="auto">{task.toAgentName}</span>
        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold", status.className)}>
          <span className={cn("material-symbols-outlined text-[12px]", task.status === "running" && "animate-spin")}>{status.icon}</span>
          {translate(status.label)}
        </span>
        {task.durationMs != null && (
          <span className="text-[10px] text-text-muted">{formatDuration(task.durationMs)}</span>
        )}
        {task.reviewStatus === "approved" && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="material-symbols-outlined text-[12px]">verified</span>{translate("Reviewed")}
          </span>
        )}
        {task.reviewStatus === "flagged" && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[12px]">flag</span>{translate("Flagged")}
          </span>
        )}
        {hasResult && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ms-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {open ? translate("Hide result") : translate("Show result")}
            <span className="material-symbols-outlined text-[14px]">{open ? "expand_less" : "expand_more"}</span>
          </button>
        )}
      </div>
      <div className="px-3 py-2 text-[13px] leading-6 text-text-muted" dir="auto">
        <span className="font-medium text-text-main">{translate("Task")}:</span> {task.instruction}
      </div>
      {open && hasResult && (
        <div className="px-3 pb-3">
          <div className="rounded-lg bg-surface-2/60 border border-border-subtle px-3 py-2.5 text-[13px] leading-6 whitespace-pre-wrap break-words text-text-main max-h-72 overflow-y-auto custom-scrollbar" dir="auto">
            {task.result}
          </div>
          {task.reviewNote && (
            <p className={cn("mt-2 text-[11px]", task.reviewStatus === "flagged" ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")} dir="auto">
              <b>{translate("Supervisor note")}:</b> {task.reviewNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Team sidebar ---------------- */

/** All agent tool grants — shown in AgentFormModal and enforced by orchestrator dispatchers. */
export const AGENT_TOOLS = [
  ["terminal", "terminal", "Terminal (root)", "Shell commands with admin approval"],
  ["browser", "language", "Browser control", "Open pages, click, fill forms, screenshot"],
  ["code", "code_blocks", "Code sandbox", "Run JavaScript in an isolated VM"],
  ["files", "folder_open", "Files", "Read/write/edit server files (writes need approval)"],
  ["web", "language", "Web fetch & search", "Fetch pages and search DuckDuckGo"],
  ["vision", "visibility", "Vision", "Ask questions about images"],
  ["image_gen", "image", "Image generation", "Create images from prompts"],
  ["video_gen", "movie", "Video generation", "Short videos from prompts"],
  ["tts", "graphic_eq", "Text-to-speech", "Speak replies as audio"],
  ["transcribe", "mic", "Speech-to-text", "Transcribe audio files"],
  ["kanban", "view_kanban", "Kanban", "Manage project boards"],
  ["mcp", "extension", "MCP", "Call external MCP server tools"],
  ["async", "outbound", "Async delegation", "Start background tasks without waiting"],
  ["worktree", "account_tree", "Git worktree", "Isolated repo sandboxes for coding"],
  ["moa", "diversity_3", "Mixture-of-Agents", "Compete answers across models, judge picks best"],
  ["osv", "gpp_maybe", "OSV scan", "Check packages for known vulnerabilities"],
  ["gdrive", "cloud", "Google Drive", "List/read Drive files (needs token in Tools settings)"],
  ["homeassistant", "home_iot_device", "Home Assistant", "Smart home states & services"],
  ["x_search", "tag", "X search", "Live X/Twitter search via xAI (needs API key)"],
  ["github", "code", "GitHub", "Read repos, and create repos, branches, files, issues and PRs (writes need approval)"],
  ["cloudflare", "cloud", "Cloudflare", "Read zones and workers, and create, update or delete DNS records and purge cache (writes need approval)"],
];
const CAPABILITIES = [
  { key: "parallel", icon: "bolt", label: "Parallel Execution" },
  { key: "skills", icon: "school", label: "Skills Library (34)" },
  { key: "learning", icon: "auto_awesome", label: "Learning Loop" },
  { key: "memory", icon: "psychology", label: "Cross-Session Memory" },
  { key: "fuzzy", icon: "find_replace", label: "Fuzzy Match" },
  { key: "ambiguity", icon: "help_center", label: "Clarification Gate" },
  { key: "errors", icon: "bug_report", label: "Error Classifier" },
  { key: "search", icon: "search", label: "Session Search" },
  { key: "todos", icon: "checklist", label: "Todo Lists" },
  { key: "code", icon: "code_blocks", label: "Code Sandbox" },
  { key: "files", icon: "folder_open", label: "File Operations" },
  { key: "web", icon: "language", label: "Web Fetch" },
  { key: "compress", icon: "compress", label: "Context Compression" },
  { key: "titles", icon: "title", label: "Auto Titles" },
  { key: "cron", icon: "schedule", label: "Cron Scheduler" },
  { key: "moa", icon: "diversity_3", label: "Mixture-of-Agents" },
  { key: "guards", icon: "shield", label: "Quality Guards" },
  { key: "verify", icon: "fact_check", label: "Supervisor Verify" },
  { key: "mcp", icon: "extension", label: "MCP Integration" },
  { key: "kanban", icon: "view_kanban", label: "Kanban Boards" },
  { key: "vision", icon: "visibility", label: "Vision (Image Q&A)" },
  { key: "image_gen", icon: "image", label: "Image Generation" },
  { key: "tts", icon: "graphic_eq", label: "Text-to-Speech" },
  { key: "transcribe", icon: "mic", label: "Speech-to-Text" },
  { key: "extract", icon: "plagiarism", label: "PDF/Office Extract" },
  { key: "patch", icon: "difference", label: "Diff Patching" },
  { key: "policy", icon: "verified_user", label: "Approval Policy (auto RO)" },
  { key: "insights", icon: "monitoring", label: "Insights & Pricing" },
  { key: "curator", icon: "cleaning_services", label: "Memory Curator" },
  { key: "skills-import", icon: "cloud_download", label: "Skills Installer" },
  { key: "async", icon: "outbound", label: "Async Delegation" },
  { key: "worktree", icon: "account_tree", label: "Git Worktree Isolation" },
  { key: "blueprints", icon: "bolt_circle", label: "Event Blueprints" },
  { key: "mcp-oauth", icon: "key_vertical", label: "MCP OAuth2" },
  { key: "gdrive", icon: "cloud", label: "Google Drive" },
  { key: "homeassistant", icon: "home_iot_device", label: "Home Assistant" },
  { key: "x_search", icon: "tag", label: "X (Twitter) Search" },
  { key: "github", icon: "code", label: "GitHub Integration" },
  { key: "cloudflare", icon: "cloud", label: "Cloudflare Integration" },
  { key: "reactions", icon: "mood", label: "Emoji Reactions" },
  { key: "tirith", icon: "security", label: "Prompt-Injection Shield" },
  { key: "terminals", icon: "sticky_note_2", label: "Persistent Terminal" },
  { key: "supervision-bg", icon: "restart_alt", label: "Process Supervision" },
  { key: "budget", icon: "speed", label: "Approval Budget" },
  { key: "web_search", icon: "travel_explore", label: "Web Search" },
  { key: "video_gen", icon: "movie", label: "Video Generation" },
  { key: "osv", icon: "gpp_maybe", label: "OSV Vulnerability Scan" },
  { key: "redact", icon: "visibility_off", label: "PII Redaction" },
  { key: "rereview", icon: "history_toggle_off", label: "Background Re-review" },
  { key: "links", icon: "share", label: "Memory Graph Links" },
  { key: "voice-tg", icon: "graphic_eq", label: "Telegram Voice Loop" },
  { key: "discord", icon: "sports_esports", label: "Discord Channel" },
  { key: "whatsapp", icon: "chat", label: "WhatsApp Cloud" },
];

export function TeamSidebar({ agents, onAdd, onEdit, onDelete, busy }) {
  const order = { ceo: 0, supervisor: 1, employee: 2 };
  const sorted = [...agents].sort((a, b) => (order[a.role] ?? 3) - (order[b.role] ?? 3));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
          <h3 className="font-semibold text-sm text-text-main">{translate("Team")}</h3>
          <Badge size="sm" variant="default">{agents.length}</Badge>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-4 text-center text-xs text-text-muted">
            {translate("No agents yet. Add a CEO first.")}
          </div>
        )}
        {sorted.map((agent, i) => (
          <div key={agent.id} className="group relative rounded-xl border border-border bg-surface p-3 hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <AgentAvatar agent={agent} index={i} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-text-main" dir="auto">{agent.name}</p>
                  {agent.status !== "active" && (
                    <span className="size-1.5 rounded-full bg-gray-400 shrink-0" title={translate("Inactive")} />
                  )}
                </div>
                <p className="truncate text-[11px] text-text-muted" dir="auto">{agent.specialty || agent.modelName || ""}</p>
              </div>
              <RoleBadge role={agent.role} />
            </div>
            <div className="absolute top-1.5 end-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
              <button type="button" onClick={() => onEdit(agent)} disabled={busy}
                className="p-1 rounded-md text-text-muted hover:text-primary hover:bg-primary/10" title={translate("Edit")}>
                <span className="material-symbols-outlined text-[15px]">edit</span>
              </button>
              <button type="button" onClick={() => onDelete(agent)} disabled={busy}
                className="p-1 rounded-md text-text-muted hover:text-red-500 hover:bg-red-500/10" title={translate("Delete")}>
                <span className="material-symbols-outlined text-[15px]">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border-subtle">
        <Button variant="outline" icon="person_add" onClick={onAdd} disabled={busy} className="w-full">
          {translate("Add member")}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Model picker (from connected providers) ---------------- */

// Model id normalization: live ids like "models/gemini-..." (Google artifact)
// are stripped before prefixing, otherwise the gateway would parse "models"
// as a provider name.
function getProviderLabel(connection) {
  const providerId = connection?.provider || connection?.id;
  const canonicalName = AI_PROVIDERS?.[providerId]?.name;
  if (canonicalName) return canonicalName;
  return connection?.name || "Unknown";
}

function normalizeModel(rawId, connection) {
  if (!rawId) return null;
  const clean = String(rawId).replace(/^models\//, "");
  let id = clean;
  const isCompatible =
    isOpenAICompatibleProvider(connection.provider) ||
    isAnthropicCompatibleProvider(connection.provider);
  if (!id.includes("/") || (isCompatible && !String(rawId).includes("/"))) {
    // Prefix with the connection's provider so the gateway can route it.
    // (Live ids that already carry a real provider segment stay untouched.)
    id = `${connection.provider}/${id}`;
  }
  return { id, name: clean.split("/").pop() || clean, providerId: connection.provider };
}

export function ModelPickerModal({ open, onClose, onSelect, currentModelId }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const providersRes = await fetch("/api/providers", { cache: "no-store" });
        const providersData = await providersRes.json().catch(() => ({}));
        const connections = Array.isArray(providersData.connections)
          ? providersData.connections.filter((c) => c?.isActive !== false)
          : [];

        const result = await Promise.all(connections.map(async (connection) => {
          const providerId = connection.provider || connection.id;
          const providerName = getProviderLabel(connection);
          const seen = new Set();
          const models = [];

          // Static catalog first  correctly prefixed and known-good.
          for (const model of getModelsByProviderId(providerId)) {
            if (!model?.id) continue;
            const entry = { id: `${providerId}/${model.id}`, name: model.name || model.id, providerId };
            if (!seen.has(entry.id)) {
              seen.add(entry.id);
              models.push(entry);
            }
          }

          // Then live models from the provider's /models endpoint.
          try {
            const res = await fetch(`/api/providers/${connection.id}/models`, { cache: "no-store" });
            const data = await res.json().catch(() => ({}));
            const list = Array.isArray(data.models) ? data.models
              : Array.isArray(data.data) ? data.data
              : Array.isArray(data.results) ? data.results
              : Array.isArray(data) ? data : [];
            for (const item of list) {
              const rawId = typeof item === "string" ? item : item?.id || item?.name || item?.model || "";
              const normalized = normalizeModel(rawId, connection);
              if (normalized && !seen.has(normalized.id)) {
                seen.add(normalized.id);
                models.push(normalized);
              }
            }
          } catch { /* static catalog is enough */ }

          return { providerId, providerName, models };
        }));

        if (!cancelled) {
          setGroups(result.filter((g) => g.models.length > 0));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.map((g) => ({
      ...g,
      models: g.models.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)),
    })).filter((g) => g.models.length > 0);
  }, [groups, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[75vh] flex flex-col rounded-2xl border border-border-subtle bg-white dark:bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <p className="text-sm font-semibold text-text-main">{translate("Assign model")}</p>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="px-3 pt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={translate("Search models...")}
            dir="auto"
            className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {loading ? (
            <div className="py-8 text-center text-sm text-text-muted">{translate("Loading models...")}</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">{translate("No models available")}</div>
          ) : (
            filtered.map((group) => (
              <div key={group.providerId} className="mb-3 last:mb-0">
                <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{group.providerName}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => { onSelect(model); onClose(); }}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-start transition",
                        model.id === currentModelId
                          ? "border-primary/40 bg-primary/10"
                          : "border-border bg-surface hover:bg-surface-2"
                      )}
                    >
                      <p className="truncate text-[13px] font-medium text-text-main">{model.name}</p>
                      <p className="truncate text-[10px] text-text-muted" dir="ltr">{model.id}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Telegram bridge modal ---------------- */

export function TelegramModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [form, setForm] = useState({ botToken: "", adminChatId: "", publicBaseUrl: "", enabled: false, mode: "webhook" });
  const [meta, setMeta] = useState({ hasToken: false, botTokenMasked: "", botUsername: null, webhook: null, pollerRunning: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadConfig = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/nova/telegram/config", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setForm({
        botToken: "",
        adminChatId: data.config?.adminChatId || "",
        publicBaseUrl: data.config?.publicBaseUrl || "",
        enabled: Boolean(data.config?.enabled),
        mode: data.config?.mode === "polling" ? "polling" : "webhook",
      });
      setMeta({
        hasToken: Boolean(data.config?.hasToken),
        botTokenMasked: data.config?.botTokenMasked || "",
        botUsername: data.botUsername || null,
        webhook: data.webhook || null,
        pollerRunning: Boolean(data.pollerRunning),
      });
    } catch (err) {
      setError(err?.message || translate("Failed to load Telegram settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setNotice("");
      loadConfig();
    }
  }, [open]);

  if (!open) return null;

  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));

  const save = async ({ silent } = {}) => {
    if (!form.adminChatId.trim() || (!meta.hasToken && !form.botToken.trim())) {
      setError(translate("Bot token and admin ID are required"));
      return false;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        adminChatId: form.adminChatId.trim(),
        publicBaseUrl: form.publicBaseUrl.trim(),
        enabled: form.enabled,
        mode: form.mode,
      };
      if (form.botToken.trim()) payload.botToken = form.botToken.trim();
      const res = await fetch("/api/dashboard/nova/telegram/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMeta((prev) => ({
        ...prev,
        hasToken: Boolean(data.config?.hasToken),
        botTokenMasked: data.config?.botTokenMasked || prev.botTokenMasked,
        botUsername: data.botUsername ?? prev.botUsername,
        webhook: data.webhook ?? prev.webhook,
        pollerRunning: Boolean(data.pollerRunning),
      }));
      patch({ botToken: "" });
      if (!silent) setNotice(translate("Settings saved"));
      return true;
    } catch (err) {
      setError(err?.message || translate("Failed to save Telegram settings"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const connectWebhook = async () => {
    const ok = await save({ silent: true });
    if (!ok) return;
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/nova/telegram/webhook/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicBaseUrl: form.publicBaseUrl.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setNotice(translate("Webhook connected"));
      loadConfig();
    } catch (err) {
      setError(err?.message || translate("Webhook setup failed"));
    } finally {
      setConnecting(false);
    }
  };

  const webhookActive = Boolean(meta.webhook?.url);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border border-border-subtle bg-white dark:bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">send</span>
            <p className="text-sm font-semibold text-text-main">{translate("Telegram bridge")}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-text-muted">{translate("Loading…")}</div>
          ) : (
            <>
              <p className="text-xs leading-5 text-text-muted" dir="auto">
                {translate("Talk to your CEO from Telegram. Only the final answer is sent there — the whole internal process stays visible here in Nova Bot.")}
              </p>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Bot token")}</span>
                <input
                  type="password"
                  value={form.botToken}
                  onChange={(e) => patch({ botToken: e.target.value })}
                  placeholder={meta.hasToken ? meta.botTokenMasked : "123456:ABC-DEF..."}
                  dir="ltr"
                  autoComplete="off"
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
                />
                <span className="mt-1 block text-[11px] text-text-muted">{translate("Get it from @BotFather")}</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Admin numeric ID")}</span>
                <input
                  type="text"
                  value={form.adminChatId}
                  onChange={(e) => patch({ adminChatId: e.target.value.replace(/[^\d-]/g, "") })}
                  placeholder="123456789"
                  dir="ltr"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
                />
                <span className="mt-1 block text-[11px] text-text-muted">{translate("Your own numeric ID from @userinfobot — only you can talk to the bot.")}</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Connection mode")}</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "polling", label: translate("Long polling (no domain needed)"), icon: "sync" },
                    { value: "webhook", label: translate("Webhook (HTTPS domain)"), icon: "link" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => patch({ mode: option.value })}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-[11px] font-medium transition",
                        form.mode === option.value
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-surface-2/30 text-text-muted hover:bg-surface-2"
                      )}
                    >
                      <span className="material-symbols-outlined text-[18px]">{option.icon}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
                <span className="mt-1 block text-[11px] text-text-muted">
                  {form.mode === "polling"
                    ? translate("The bot fetches messages itself — works on plain IP, no SSL required.")
                    : translate("Telegram calls your server — needs a working HTTPS domain.")}
                </span>
              </label>

              <label className={cn("block", form.mode === "polling" && "opacity-50")}>
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Public base URL (optional)")}</span>
                <input
                  type="url"
                  value={form.publicBaseUrl}
                  onChange={(e) => patch({ publicBaseUrl: e.target.value })}
                  placeholder="https://panel.example.com"
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
                />
                <span className="mt-1 block text-[11px] text-text-muted">{translate("Leave empty to auto-detect. Must be HTTPS — Telegram requires it.")}</span>
              </label>

              <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2/30 px-3 py-2.5 cursor-pointer">
                <span className="text-xs font-medium text-text-main">{translate("Enable bridge")}</span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => patch({ enabled: e.target.checked })}
                  className="size-4 accent-[var(--color-primary)]"
                />
              </label>

              <div className="rounded-xl border border-border-subtle bg-surface-2/30 px-3 py-2.5 text-xs space-y-1">
                <p className="flex items-center gap-1.5">
                  <span className={cn(
                    "size-2 rounded-full",
                    form.mode === "polling"
                      ? (meta.pollerRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-500")
                      : (webhookActive ? "bg-emerald-500" : "bg-zinc-400")
                  )} />
                  <span className="font-medium text-text-main">{translate("Status")}:</span>
                  <span className="text-text-muted">
                    {form.mode === "polling"
                      ? (meta.pollerRunning ? translate("Polling active") : translate("Polling idle — press Save to start"))
                      : (webhookActive ? translate("Webhook active") : translate("Not connected"))}
                  </span>
                </p>
                {meta.botUsername && (
                  <p className="text-text-muted" dir="ltr">@{meta.botUsername}</p>
                )}
                {webhookActive && (
                  <p className="truncate text-text-muted" dir="ltr">{meta.webhook.url}</p>
                )}
                {meta.webhook?.last_error_message && (
                  <p className="text-red-500" dir="auto">{translate("Last error")}: {meta.webhook.last_error_message}</p>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400" dir="auto">{error}</p>
              )}
              {notice && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400" dir="auto">{notice}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>{translate("Close")}</Button>
          <Button variant="secondary" size="sm" disabled={loading || saving || connecting} onClick={() => save()}>
            {saving ? translate("Saving…") : translate("Save")}
          </Button>
          <Button variant="primary" size="sm" icon="link" disabled={loading || saving || connecting || form.mode === "polling"} onClick={connectWebhook}>
            {connecting ? translate("Connecting…") : translate("Connect webhook")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Instagram DM bridge modal ---------------- */

export function InstagramModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ pageAccessToken: "", pageId: "", adminIgUserId: "", enabled: false, alwaysReply: true, autoApproveAfterN: 0, behaviorPrompt: "" });
  const [meta, setMeta] = useState({ hasToken: false, pageAccessTokenMasked: "", hasSecret: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadConfig = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/nova/instagram/config", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setForm({
        pageAccessToken: "",
        pageId: data.config?.pageId || "",
        adminIgUserId: data.config?.adminIgUserId || "",
        enabled: Boolean(data.config?.enabled),
        alwaysReply: Boolean(data.config?.alwaysReply),
        autoApproveAfterN: data.config?.autoApproveAfterN || 0,
        behaviorPrompt: data.config?.behaviorPrompt || "",
      });
      setMeta({
        hasToken: Boolean(data.config?.hasToken),
        pageAccessTokenMasked: data.config?.pageAccessToken || "",
        hasSecret: Boolean(data.config?.hasSecret),
      });
    } catch (err) {
      setError(err?.message || translate("Failed to load Instagram settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) { setNotice(""); loadConfig(); }
  }, [open]);

  if (!open) return null;

  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));

  const save = async () => {
    if (!form.pageAccessToken.trim() && !meta.hasToken) {
      setError(translate("Page Access Token is required"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        pageId: form.pageId.trim(),
        adminIgUserId: form.adminIgUserId.trim(),
        enabled: form.enabled,
        alwaysReply: form.alwaysReply,
        autoApproveAfterN: Number(form.autoApproveAfterN) || 0,
        behaviorPrompt: form.behaviorPrompt.trim(),
      };
      if (form.pageAccessToken.trim()) payload.pageAccessToken = form.pageAccessToken.trim();
      const res = await fetch("/api/dashboard/nova/instagram/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setMeta((prev) => ({ ...prev, hasToken: Boolean(data.config?.hasToken), pageAccessTokenMasked: data.config?.pageAccessToken || prev.pageAccessTokenMasked }));
      patch({ pageAccessToken: "" });
      setNotice(translate("Settings saved"));
    } catch (err) {
      setError(err?.message || translate("Failed to save Instagram settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border border-border-subtle bg-white dark:bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-pink-500">
              <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153.509.5.902 1.105 1.153 1.772.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772c-.5.508-1.105.902-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
            </svg>
            <p className="text-sm font-semibold text-text-main">{translate("Instagram DM Bridge")}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-text-muted">{translate("Loading…")}</div>
          ) : (
            <>
              <p className="text-xs leading-5 text-text-muted" dir="auto">
                {translate("Auto-reply to Instagram DMs with AI. Drafts are sent to your Telegram bot for approval before sending.")}
              </p>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Page Access Token")}</span>
                <input
                  type="password"
                  value={form.pageAccessToken}
                  onChange={(e) => patch({ pageAccessToken: e.target.value })}
                  placeholder={meta.hasToken ? meta.pageAccessTokenMasked : "EAA..."}
                  dir="ltr"
                  autoComplete="off"
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
                />
                <span className="mt-1 block text-[11px] text-text-muted">{translate("From Meta Graph API Explorer — needs pages_messaging permission")}</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Page ID")}</span>
                <input
                  type="text"
                  value={form.pageId}
                  onChange={(e) => patch({ pageId: e.target.value })}
                  placeholder="123456789"
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
                />
                <span className="mt-1 block text-[11px] text-text-muted">{translate("Your Instagram Page ID from Graph API")}</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Admin Instagram User ID")}</span>
                <input
                  type="text"
                  value={form.adminIgUserId}
                  onChange={(e) => patch({ adminIgUserId: e.target.value })}
                  placeholder="17841400..."
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
                />
                <span className="mt-1 block text-[11px] text-text-muted">{translate("Your own Instagram user ID — only you can configure the bridge")}</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Auto-approve after N approvals")}</span>
                <input
                  type="number"
                  value={form.autoApproveAfterN}
                  onChange={(e) => patch({ autoApproveAfterN: e.target.value })}
                  min="0"
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
                />
                <span className="mt-1 block text-[11px] text-text-muted">{translate("0 = always ask for approval. After N manual approvals, AI replies automatically.")}</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-text-main">{translate("Behavior prompt (optional)")}</span>
                <textarea
                  value={form.behaviorPrompt}
                  onChange={(e) => patch({ behaviorPrompt: e.target.value })}
                  rows={2}
                  placeholder={translate("e.g. Answer in formal Persian, be polite...")}
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40 resize-none"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2/30 px-3 py-2.5 cursor-pointer">
                <span className="text-xs font-medium text-text-main">{translate("Enable bridge")}</span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => patch({ enabled: e.target.checked })}
                  className="size-4 accent-[var(--color-primary)]"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2/30 px-3 py-2.5 cursor-pointer">
                <span className="text-xs font-medium text-text-main">{translate("Always reply (AI auto-reply)")}</span>
                <input
                  type="checkbox"
                  checked={form.alwaysReply}
                  onChange={(e) => patch({ alwaysReply: e.target.checked })}
                  className="size-4 accent-[var(--color-primary)]"
                />
              </label>

              <div className="rounded-xl border border-border-subtle bg-surface-2/30 px-3 py-2.5 text-xs space-y-1">
                <p className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", form.enabled ? "bg-emerald-500" : "bg-zinc-400")} />
                  <span className="font-medium text-text-main">{translate("Status")}:</span>
                  <span className="text-text-muted">
                    {form.enabled ? translate("Active — AI will reply to DMs") : translate("Disabled")}
                  </span>
                </p>
                {meta.hasToken && (
                  <p className="text-text-muted">{translate("Token configured")} ✓</p>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400" dir="auto">{error}</p>
              )}
              {notice && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400" dir="auto">{notice}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>{translate("Close")}</Button>
          <Button variant="primary" size="sm" disabled={loading || saving} onClick={save}>
            {saving ? translate("Saving…") : translate("Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- GitHub Modal ---------------- */

export function GitHubModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ connected: false, user: null });
  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [showRepos, setShowRepos] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/nova/github/auth/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setStatus({
        connected: Boolean(data.connected),
        user: data.user || null,
      });
    } catch (err) {
      setError(err?.message || translate("Failed to load GitHub status"));
    } finally {
      setLoading(false);
    }
  };

  const loadRepos = async () => {
    setReposLoading(true);
    try {
      const res = await fetch("/api/dashboard/nova/github/api/user/repos?sort=updated&per_page=20", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      setRepos(Array.isArray(data) ? data : []);
      setShowRepos(true);
    } catch {
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  };

  useEffect(() => {
    if (open) { setNotice(""); setError(""); setShowRepos(false); setRepos([]); loadStatus(); }
  }, [open]);

  if (!open) return null;

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) { setError(translate("Token is required")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/nova/github/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to verify token");
      setNotice(translate("GitHub connected successfully!"));
      setTokenInput("");
      await loadStatus();
    } catch (err) {
      setError(err?.message || translate("Failed to connect GitHub"));
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(translate("Disconnect GitHub account?"))) return;
    try {
      await fetch("/api/dashboard/nova/github/auth/status", { method: "DELETE" }).catch(() => {});
      setStatus({ connected: false, user: null });
      setRepos([]);
      setShowRepos(false);
      setNotice(translate("GitHub account disconnected"));
    } catch (err) {
      setError(err?.message);
    }
  };

  const user = status.user;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-2xl" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#24292f]/10">
              <svg viewBox="0 0 16 16" className="size-6 fill-[#24292f] dark:fill-white"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main">{translate("GitHub Connection")}</h2>
              <p className="text-xs text-text-muted">{translate("Manage your GitHub account")}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-main transition">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          {notice && (
            <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-text-muted">{translate("Loading…")}</p>
          ) : (
            <>
              {/* Connection Status */}
              <div className={`mb-4 rounded-xl border p-4 ${status.connected ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-surface-2/30"}`}>
                <div className="flex items-center gap-3">
                  <div className={`size-3 rounded-full ${status.connected ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"}`} />
                  <div>
                    <p className="text-sm font-semibold text-text-main">
                      {status.connected ? translate("Connected") : translate("Not connected")}
                    </p>
                    {user && (
                      <p className="text-xs text-text-muted">
                        {user.login} · {user.public_repos} {translate("repos")} · {user.followers} {translate("followers")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Connect / Connected */}
              {!status.connected ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-surface-2/30 p-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-text-main">{translate("Personal Access Token")}</span>
                      <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx" dir="ltr" autoComplete="off"
                        className="w-full rounded-xl border border-border bg-white dark:bg-surface/50 px-3 py-2.5 text-sm font-mono text-text-main outline-none focus:border-primary/40" />
                    </label>
                    <p className="mt-1.5 text-[11px] text-text-muted" dir="auto">
                      {translate("Go to")} <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">github.com/settings/tokens</a> {translate("→ generate token with scopes:")} <code className="text-[10px] bg-surface-2/60 px-1 rounded">repo</code> <code className="text-[10px] bg-surface-2/60 px-1 rounded">read:user</code>
                    </p>
                  </div>
                  <button
                    onClick={handleSaveToken}
                    disabled={saving || !tokenInput.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#24292f]/20 bg-[#24292f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#24292f]/90 transition disabled:opacity-50"
                  >
                    <svg viewBox="0 0 16 16" className="size-4 fill-white"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                    {saving ? translate("Verifying…") : translate("Connect GitHub Account")}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={loadRepos}
                    disabled={reposLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/40 px-4 py-2.5 text-sm font-medium text-text-main hover:bg-surface-2 transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">folder_open</span>
                    {reposLoading ? translate("Loading…") : translate("List Repos")}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">link_off</span>
                    {translate("Disconnect")}
                  </button>
                </div>
              )}

              {/* Repos List */}
              {showRepos && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">{translate("Recent Repos")}</h3>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {repos.length === 0 ? (
                      <p className="py-4 text-center text-xs text-text-muted">{translate("No repos found")}</p>
                    ) : repos.map((r) => (
                      <a
                        key={r.id}
                        href={r.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-xl border border-border bg-surface-2/30 px-3 py-2.5 hover:bg-surface-2 transition"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-main">{r.name}</p>
                          <p className="truncate text-xs text-text-muted">{r.description || translate("No description")}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.private && <span className="material-symbols-outlined text-[14px] text-amber-500">lock</span>}
                          <span className="text-xs text-text-muted">⭐ {r.stargazers_count}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border-subtle px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>{translate("Close")}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Cloudflare Modal ---------------- */

export function CloudflareModal({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ connected: false, user: null });
  const [tokenInput, setTokenInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/nova/cloudflare/auth/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setStatus({
        connected: Boolean(data.connected),
        user: data.user || null,
      });
    } catch (err) {
      setError(err?.message || translate("Failed to load Cloudflare status"));
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async () => {
    setZonesLoading(true);
    try {
      const res = await fetch("/api/dashboard/nova/cloudflare/api/zones?per_page=20", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setZones(data?.result || []);
      setShowZones(true);
    } catch {
      setZones([]);
    } finally {
      setZonesLoading(false);
    }
  };

  useEffect(() => {
    if (open) { setNotice(""); setError(""); setShowZones(false); setZones([]); loadStatus(); }
  }, [open]);

  if (!open) return null;

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) { setError(translate("Token is required")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/nova/cloudflare/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to verify token");
      setNotice(translate("Cloudflare connected successfully!"));
      setTokenInput("");
      await loadStatus();
    } catch (err) {
      setError(err?.message || translate("Failed to connect Cloudflare"));
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(translate("Disconnect Cloudflare account?"))) return;
    try {
      await fetch("/api/dashboard/nova/cloudflare/auth/status", { method: "DELETE" }).catch(() => {});
      setStatus({ connected: false, user: null });
      setZones([]);
      setShowZones(false);
      setNotice(translate("Cloudflare account disconnected"));
    } catch (err) {
      setError(err?.message);
    }
  };

  const user = status.user;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-2xl" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#F38020]/10">
              <svg viewBox="0 0 100 100" className="size-6 fill-[#F38020]"><path d="M67.3 39.2c-1.4 0-2.9.2-4.3.6-1-4.2-5.1-7.3-10-7.3-1.4 0-2.8.3-4.1.8C47.8 25.2 42.1 21 35.4 21c-2.8 0-5.5.7-7.9 2-2.1-3.4-5.9-5.7-10.1-5.7-6.3 0-11.4 5.1-11.4 11.4 0 .7.1 1.4.2 2.1C2.5 32.6 0 37 0 41.9c0 5.8 4.7 10.5 10.5 10.5h48.6c4.7 0 8.5-3.8 8.5-8.5 0-4.2-3.1-7.7-7.1-8.4-.2-.4-.2-.9-.2-1.3 0-2 1.6-3.6 3.6-3.6h6.4c2.8 0 5.1-2.3 5.1-5.1 0-2.6-1.9-4.7-4.4-5.1-.3-.7-.4-1.5-.4-2.3 0-2.5-1.2-4.8-3-6.3-.3-.3-.6-.5-.9-.7-.2-.1-.4-.2-.6-.3z" /></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main">{translate("Cloudflare Connection")}</h2>
              <p className="text-xs text-text-muted">{translate("Manage your Cloudflare account")}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-main transition">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          {notice && (
            <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-text-muted">{translate("Loading…")}</p>
          ) : (
            <>
              {/* Connection Status */}
              <div className={`mb-4 rounded-xl border p-4 ${status.connected ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-surface-2/30"}`}>
                <div className="flex items-center gap-3">
                  <div className={`size-3 rounded-full ${status.connected ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"}`} />
                  <div>
                    <p className="text-sm font-semibold text-text-main">
                      {status.connected ? translate("Connected") : translate("Not connected")}
                    </p>
                    {user && (
                      <p className="text-xs text-text-muted">
                        {user.email} · {user.username}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Connect / Connected */}
              {!status.connected ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-surface-2/30 p-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-text-main">{translate("API Token")}</span>
                      <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="xxxxxxxxxxxxxxxxxxx" dir="ltr" autoComplete="off"
                        className="w-full rounded-xl border border-border bg-white dark:bg-surface/50 px-3 py-2.5 text-sm font-mono text-text-main outline-none focus:border-primary/40" />
                    </label>
                    <p className="mt-1.5 text-[11px] text-text-muted" dir="auto">
                      {translate("Go to")} <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dash.cloudflare.com/profile/api-tokens</a> {translate("→ create token with permissions:")} <code className="text-[10px] bg-surface-2/60 px-1 rounded">Zone:Edit</code> <code className="text-[10px] bg-surface-2/60 px-1 rounded">DNS:Edit</code>
                    </p>
                  </div>
                  <button
                    onClick={handleSaveToken}
                    disabled={saving || !tokenInput.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#F38020]/30 bg-[#F38020] px-4 py-3 text-sm font-semibold text-white hover:bg-[#F38020]/90 transition disabled:opacity-50"
                  >
                    <svg viewBox="0 0 100 100" className="size-4 fill-white"><path d="M67.3 39.2c-1.4 0-2.9.2-4.3.6-1-4.2-5.1-7.3-10-7.3-1.4 0-2.8.3-4.1.8C47.8 25.2 42.1 21 35.4 21c-2.8 0-5.5.7-7.9 2-2.1-3.4-5.9-5.7-10.1-5.7-6.3 0-11.4 5.1-11.4 11.4 0 .7.1 1.4.2 2.1C2.5 32.6 0 37 0 41.9c0 5.8 4.7 10.5 10.5 10.5h48.6c4.7 0 8.5-3.8 8.5-8.5 0-4.2-3.1-7.7-7.1-8.4-.2-.4-.2-.9-.2-1.3 0-2 1.6-3.6 3.6-3.6h6.4c2.8 0 5.1-2.3 5.1-5.1 0-2.6-1.9-4.7-4.4-5.1-.3-.7-.4-1.5-.4-2.3 0-2.5-1.2-4.8-3-6.3-.3-.3-.6-.5-.9-.7-.2-.1-.4-.2-.6-.3z" /></svg>
                    {saving ? translate("Verifying…") : translate("Connect Cloudflare Account")}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={loadZones}
                    disabled={zonesLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/40 px-4 py-2.5 text-sm font-medium text-text-main hover:bg-surface-2 transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">language</span>
                    {zonesLoading ? translate("Loading…") : translate("List Zones")}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                  >
                    <span className="material-symbols-outlined text-[18px]">link_off</span>
                    {translate("Disconnect")}
                  </button>
                </div>
              )}

              {/* Zones List */}
              {showZones && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">{translate("Your Zones")}</h3>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {zones.length === 0 ? (
                      <p className="py-4 text-center text-xs text-text-muted">{translate("No zones found")}</p>
                    ) : zones.map((z) => (
                      <div
                        key={z.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-surface-2/30 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-main">{z.name}</p>
                          <p className="truncate text-xs text-text-muted">{z.status} · {z.name_servers?.[0] || ""}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${z.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                          {z.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Services */}
              {status.connected && (
                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">{translate("Services")}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: "language", label: "DNS", color: "text-blue-500" },
                      { icon: "bolt", label: "Workers", color: "text-amber-500" },
                      { icon: "web", label: "Pages", color: "text-violet-500" },
                      { icon: "cloud_upload", label: "R2", color: "text-emerald-500" },
                      { icon: "key", label: "KV", color: "text-pink-500" },
                      { icon: "database", label: "D1", color: "text-cyan-500" },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface-2/30 px-2 py-3 text-center">
                        <span className={`material-symbols-outlined text-[20px] ${s.color}`}>{s.icon}</span>
                        <span className="text-[10px] font-medium text-text-muted">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border-subtle px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>{translate("Close")}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Agent form modal ---------------- */

const EMPTY_FORM = { name: "", role: "employee", specialty: "", systemPrompt: "", modelId: "", modelName: "", providerId: "", status: "active", tools: [] };

export function AgentFormModal({ open, editing, onClose, onSave, busy }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(editing ? {
        name: editing.name || "",
        role: editing.role || "employee",
        specialty: editing.specialty || "",
        systemPrompt: editing.systemPrompt || "",
        modelId: editing.modelId || "",
        modelName: editing.modelName || "",
        providerId: editing.providerId || "",
        status: editing.status || "active",
        tools: String(editing.tools || "").split(",").map((t) => t.trim()).filter(Boolean),
      } : EMPTY_FORM);
      setError("");
    }
  }, [open, editing]);

  if (!open) return null;

  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));

  const submit = () => {
    if (!form.name.trim()) { setError(translate("Name is required")); return; }
    if (!form.modelId) { setError(translate("Please assign a model")); return; }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar rounded-2xl border border-border-subtle bg-white dark:bg-surface shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-main">{editing ? translate("Edit member") : translate("New member")}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{translate("Name")}</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder={form.role === "ceo" ? "Max" : "..."}
            dir="auto"
            className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">{translate("Role")}</span>
          <div className="grid grid-cols-3 gap-1.5">
            {Object.entries(ROLE_META).map(([role, meta]) => (
              <button
                key={role}
                type="button"
                onClick={() => patch({ role })}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition",
                  form.role === role
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-surface text-text-muted hover:bg-surface-2"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                {translate(meta.label)}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{translate("Specialty")}</span>
          <input
            type="text"
            value={form.specialty}
            onChange={(e) => patch({ specialty: e.target.value })}
            placeholder={translate("e.g. SEO content writer")}
            dir="auto"
            className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">{translate("Model")}</span>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-start transition",
              form.modelId ? "border-border bg-surface hover:bg-surface-2" : "border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10"
            )}
          >
            <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text-main">{form.modelName || translate("Choose a model")}</span>
              {form.modelId && <span className="block truncate text-[10px] text-text-muted" dir="ltr">{form.modelId}</span>}
            </span>
            <span className="material-symbols-outlined text-[18px] text-text-muted">expand_more</span>
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">{translate("System prompt")}</span>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => patch({ systemPrompt: e.target.value })}
            rows={4}
            placeholder={translate("Custom instructions for this agent...")}
            dir="auto"
            className="w-full resize-none rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted focus:border-primary/40 custom-scrollbar"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-text-muted">{translate("System access")}</span>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {AGENT_TOOLS.map(([key, icon, label, hint]) => (
              <label key={key} className={cn(
                "flex items-center gap-2 rounded-xl border px-2.5 py-2 cursor-pointer transition",
                form.tools.includes(key) ? "border-primary/50 bg-primary/10" : "border-border bg-surface hover:bg-surface-2"
              )}>
                <input
                  type="checkbox"
                  checked={form.tools.includes(key)}
                  onChange={(e) => patch({
                    tools: e.target.checked ? [...form.tools, key] : form.tools.filter((t) => t !== key),
                  })}
                  className="size-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="material-symbols-outlined shrink-0 text-[16px] text-text-muted">{icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-text-main">{translate(label)}</span>
                  <span className="block truncate text-[9px] text-text-muted">{translate(hint)}</span>
                </span>
              </label>
            ))}          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5">
          <span className="text-sm text-text-main">{translate("Active")}</span>
          <input
            type="checkbox"
            checked={form.status === "active"}
            onChange={(e) => patch({ status: e.target.checked ? "active" : "inactive" })}
            className="size-4 accent-[var(--primary)]"
          />
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={busy}>{translate("Cancel")}</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {editing ? translate("Save changes") : translate("Create")}
          </Button>
        </div>
      </div>

      <ModelPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentModelId={form.modelId}
        onSelect={(model) => patch({ modelId: model.id, modelName: model.name, providerId: model.providerId })}
      />
    </div>
  );
}

/* ---------------- Supervision panel ---------------- */

function formatAvg(ms) {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function relative(value) {
  if (!value) return "";
  const diffMin = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (diffMin < 1) return translate("just now");
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h`;
  return `${Math.round(diffMin / 1440)}d`;
}

export function SupervisionPanel({ open, onClose, stats, loading }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 end-0 bottom-0 z-[65] w-full max-w-md border-s border-border-subtle bg-bg shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-500 text-[20px]">monitoring</span>
            <h3 className="font-semibold text-text-main">{translate("Supervision room")}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <p className="py-8 text-center text-sm text-text-muted">{translate("Loading...")}</p>
          ) : stats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-6 text-center text-sm text-text-muted">
              {translate("No employees or supervisor to supervise yet.")}
            </div>
          ) : (
            <div className="space-y-3">
              {stats.map((s) => {
                const lazy = s.assigned > 0 && s.done === 0 && s.failed === 0;
                return (
                  <div key={s.agentId} className="rounded-xl border border-border bg-surface p-3.5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <AgentAvatar agent={{ name: s.name, role: s.role }} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text-main" dir="auto">{s.name}</p>
                        <p className="truncate text-[11px] text-text-muted" dir="ltr">{s.modelName || ""}</p>
                      </div>
                      <RoleBadge role={s.role} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Stat label="Assigned" value={s.assigned} />
                      <Stat label="Done" value={s.done} tone="text-emerald-600 dark:text-emerald-400" />
                      <Stat label="Failed" value={s.failed} tone="text-red-500" />
                      <Stat label="Flagged" value={s.flagged} tone="text-amber-500" />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-text-muted">
                      <span>{translate("Avg time")}: <b className="text-text-main">{formatAvg(s.avgDurationMs)}</b></span>
                      {s.role === "supervisor" && <span>{translate("Reviews done")}: <b className="text-text-main">{s.reviewsDone}</b></span>}
                      <span>{translate("Last active")}: <b className="text-text-main">{relative(s.lastActiveAt)}</b></span>
                    </div>
                    {lazy && (
                      <p className="mt-2 flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <span className="material-symbols-outlined text-[13px]">warning</span>
                        {translate("This member was assigned tasks but never completed one.")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone = "text-text-main" }) {
  return (
    <div className="rounded-lg bg-surface-2/60 px-1.5 py-2">
      <p className={cn("text-base font-bold", tone)}>{value}</p>
      <p className="text-[10px] text-text-muted">{translate(label)}</p>
    </div>
  );
}

function textValue(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function UserbotModal({ open, onClose, agents }) {
  const [secKey, setSecKey] = useState("");
  const [keyUnlocked, setKeyUnlocked] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [cfg, setCfg] = useState({});
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [twoFa, setTwoFa] = useState("");
  const [newKey, setNewKey] = useState("");
  const [kbItem, setKbItem] = useState({ kind: "qa", id: "", q: "", a: "", title: "", content: "", pinned: false });
  const [kbKind, setKbKind] = useState("qa");
  const [drafts, setDrafts] = useState([]);
  const [draftTexts, setDraftTexts] = useState({});
  const [chats, setChats] = useState([]);
  const [showChats, setShowChats] = useState(false);
  const [editingMsg, setEditingMsg] = useState(null); // { chatId, tgId, text }
  const [memories, setMemories] = useState([]);

  const editKbItem = (item) => {
    setKbKind(item.kind === "doc" ? "doc" : "qa");
    setKbItem({
      kind: item.kind === "doc" ? "doc" : "qa",
      id: item.id,
      q: item.q || "",
      a: item.a || "",
      title: item.title || "",
      content: item.content || "",
      pinned: !!item.pinned,
    });
  };

  const saveKbItem = async () => {
    if (kbKind === "qa" && (!kbItem.q.trim() || !kbItem.a.trim())) return;
    if (kbKind === "doc" && !kbItem.content.trim()) return;
    setBusy(true);
    try {
      const payload = kbKind === "qa"
        ? { id: kbItem.id || undefined, kind: "qa", q: kbItem.q, a: kbItem.a }
        : { id: kbItem.id || undefined, kind: "doc", title: kbItem.title, content: kbItem.content };
      const r = await call("POST", { action: "kb-add", ...payload, pinned: kbItem.pinned });
      if (r?.kb) setKb(r.kb);
      setKbItem({ kind: kbKind, id: "", q: "", a: "", title: "", content: "", pinned: false });
      setMsg(translate("Saved"));
    } catch (e) {
      setError(textValue(e?.message));
    } finally { setBusy(false); }
  };
  const [kb, setKb] = useState([]);

  const resolveDraft = async (d, approve) => {
    const r = await runAction("draft-resolve", { id: d.id, approve, text: draftTexts[d.id] });
    if (r) {
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
      if (approve) load();
    }
  };

  const saveSentEdit = async () => {
    if (!editingMsg?.text?.trim()) return;
    const r = await runAction("msg-edit", editingMsg);
    if (r) {
      const { chatId, tgId, text } = editingMsg;
      setChats((prev) => prev.map((c) => (
        c.chatId === chatId && c.lastMe?.tgId === tgId ? { ...c, lastMe: { ...c.lastMe, text } } : c
      )));
      setEditingMsg(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    setError(""); setMsg(""); setStatus(null); setKb([]); setDrafts([]); setDraftTexts({}); setChats([]); setEditingMsg(null); setShowChats(false); setMemories([]);
    const saved = sessionStorage.getItem("novaTgSecKey") || "";
    if (saved) { setSecKey(saved); }
  }, [open]);

  const call = async (method, body, extraHeaders = {}) => {
    const res = await fetch("/api/dashboard/nova/userbot", {
      method,
      headers: { "Content-Type": "application/json", "x-tg-security-key": secKey, ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(textValue(data.error) || `Failed (${res.status})`);
    return data;
  };

  const load = async () => {
    setBusy(true); setError("");
    try {
      sessionStorage.setItem("novaTgSecKey", secKey);
      const s = await call("GET");
      setStatus(s);
      if (s.securityKeyRequired && !s.securityKeySet) { setKeyUnlocked(true); }
      else setKeyUnlocked(true);
      setCfg({ ...s.config });
      try {
        const kbRes = await call("POST", { action: "kb-list" });
        if (Array.isArray(kbRes.kb)) setKb(kbRes.kb);
      } catch {}
      try {
        const dRes = await call("POST", { action: "draft-list" });
        const list = Array.isArray(dRes.drafts) ? dRes.drafts : [];
        setDrafts(list);
        setDraftTexts(Object.fromEntries(list.map((d) => [d.id, d.draft || ""])));
      } catch {}
      try {
        const cRes = await call("POST", { action: "contacts-list" });
        setChats(Array.isArray(cRes.contacts) ? cRes.contacts : []);
      } catch {}
      try {
        const mRes = await call("POST", { action: "memory-list" });
        setMemories(Array.isArray(mRes.memories) ? mRes.memories : []);
      } catch {}
    } catch (e) {
      const msg = textValue(e?.message || "");
      if (msg.includes("Wrong security key")) {
        setKeyUnlocked(false);
      } else {
        setError(msg);
      }
    } finally { setBusy(false); }
  };

  const runAction = async (action, extra = {}) => {
    setBusy(true); setError(""); setMsg("");
    try {
      const out = await call("POST", { action, ...extra });
      setMsg(translate("Done"));
      return out;
    } catch (e) {
      setError(textValue(e?.message));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true); setError("");
    try {
      await call("PUT", cfg);
      setMsg(translate("Saved"));
    } catch (e) { setError(textValue(e?.message)); } finally { setBusy(false); }
  };

  const saveCredentials = async () => {
    setBusy(true); setError("");
    try {
      await call("PUT", { kind: "credentials", apiId, apiHash });
      setApiId(""); setApiHash("");
      setMsg(translate("Credentials saved"));
      await load();
    } catch (e) { setError(textValue(e?.message)); } finally { setBusy(false); }
  };

  if (!open) return null;

  const patch = (p) => setCfg((prev) => ({ ...prev, ...p }));

  const ToggleRow = ({ label, value, onChange }) => (
    <label className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5">
      <span className="text-sm text-text-main">{label}</span>
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto custom-scrollbar rounded-2xl border border-border-subtle bg-white dark:bg-surface shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">support_agent</span>
            {translate("Contacts auto-responder (personal account)")}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {!status ? (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">{translate("This section is protected by a separate security key — the dashboard password alone cannot access it.")}</p>
            <input
              type="password"
              value={secKey}
              onChange={(e) => setSecKey(e.target.value)}
              placeholder={translate("Security key")}
              dir="ltr"
              className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
            />
            <Button onClick={load} disabled={busy || !secKey} className="w-full">
              {busy ? "" : translate("Unlock")}
            </Button>
          </div>
        ) : !status.securityKeySet ? (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">{translate("Choose a security key (min 6 chars). You will need it for every change here.")}</p>
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder={translate("New security key")}
              dir="ltr"
              className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
            />
            <Button
              onClick={async () => { const ok = await runAction("set-key", { newKey }); if (ok) { sessionStorage.setItem("novaTgSecKey", newKey); await load(); } }}
              disabled={busy || newKey.length < 6}
              className="w-full"
            >
              {translate("Set security key")}
            </Button>
          </div>
        ) : (
          <>
            {/* status */}
            <div className="flex items-center gap-2 text-xs">
              <span className={cn("size-2 rounded-full", status.running ? "bg-emerald-500" : status.configured ? "bg-amber-500" : "bg-zinc-400")} />
              <span className="text-text-muted">
                {status.running ? translate("Connected & listening")
                  : status.loginStage === "awaiting-code" ? translate("Waiting for login code…")
                  : status.loginStage === "awaiting-password" ? translate("Waiting for 2FA password…")
                  : status.connected ? translate("Ready — press Enable")
                  : translate("Not configured yet")}
              </span>
              {status.stats && <span className="ms-auto text-text-muted">{status.stats.pendingDrafts}   {status.stats.contactsTracked} </span>}
            </div>

            {/* credentials + login */}
            {!status.connected && (
              <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                <p className="text-xs font-medium text-text-muted">{translate("1. Telegram API credentials (from my.telegram.org)")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="api_id" dir="ltr" className="rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-sm outline-none focus:border-primary/40" />
                  <input value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="api_hash" dir="ltr" className="rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-sm outline-none focus:border-primary/40" />
                </div>
                {status.config.apiHashMasked && <p className="text-[10px] text-text-muted">{translate("Saved:")} {status.config.apiHashMasked}</p>}
                <Button variant="secondary" size="sm" onClick={saveCredentials} disabled={busy} className="w-full">{translate("Save credentials")}</Button>

                <p className="pt-1 text-xs font-medium text-text-muted">{translate("2. Login with your phone number")}</p>
                <div className="flex gap-2">
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+98912..." dir="ltr" className="flex-1 rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-sm outline-none focus:border-primary/40" />
                  <Button size="sm" onClick={async () => { await runAction("send-code", { phoneNumber: phone }); await load(); }} disabled={busy || !phone}>{translate("Send code")}</Button>
                </div>
                {status.loginStage === "awaiting-code" && (
                  <div className="flex gap-2">
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={translate("Login code")} dir="ltr" className="flex-1 rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-sm outline-none focus:border-primary/40" />
                    <Button size="sm" onClick={async () => { const r = await runAction("sign-in", { code }); if (r) await load(); }} disabled={busy || !code}>{translate("Sign in")}</Button>
                  </div>
                )}
                {status.loginStage === "awaiting-password" && (
                  <div className="flex gap-2">
                    <input type="password" value={twoFa} onChange={(e) => setTwoFa(e.target.value)} placeholder={translate("Two-factor password")} dir="ltr" className="flex-1 rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-sm outline-none focus:border-primary/40" />
                    <Button size="sm" onClick={async () => { const r = await runAction("sign-in-password", { password: twoFa }); if (r) await load(); }} disabled={busy || !twoFa}>{translate("Confirm")}</Button>
                  </div>
                )}
              </div>
            )}

            {status.connected && (
              <ToggleRow label={translate("Enabled — answer incoming messages")} value={cfg.enabled} onChange={(v) => patch({ enabled: v })} />
            )}

            {/* behavior */}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-muted">{translate("Which team member answers?")}</span>
              <select
                value={cfg.agentId || ""}
                onChange={(e) => patch({ agentId: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40"
              >
                <option value="">{translate("(first active member)")}</option>
                {agents.filter((a) => a.status !== "inactive").map((a) => (
                  <option key={a.id} value={a.id}>{a.name}  {a.role}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-muted">{translate("Behavior instructions")}</span>
              <textarea
                value={cfg.behaviorPrompt || ""}
                onChange={(e) => patch({ behaviorPrompt: e.target.value })}
                rows={3}
                dir="auto"
                placeholder={translate("How should it talk? Polite Persian, short answers, never invent prices…")}
                className="w-full resize-none rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm outline-none placeholder:text-text-muted focus:border-primary/40 custom-scrollbar"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-text-muted">{translate("Auto-send after N approved replies per contact (0 = always ask me)")}</span>
              <input
                type="number" min="0" max="50"
                value={cfg.autoApproveAfterN ?? 0}
                onChange={(e) => patch({ autoApproveAfterN: Number(e.target.value) })}
                dir="ltr"
                className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm outline-none focus:border-primary/40"
              />
            </label>

            <div className="space-y-1.5">
              <ToggleRow label={translate("Reply in groups (only when mentioned or replied-to)")} value={cfg.allowGroups} onChange={(v) => patch({ allowGroups: v })} />
              <ToggleRow label={translate("Read & reply in channels (broadcast posts)")} value={cfg.allowChannels} onChange={(v) => patch({ allowChannels: v })} />
              <ToggleRow label={translate("Reply to bot accounts (off = humans only)")} value={cfg.allowBots} onChange={(v) => patch({ allowBots: v })} />
              <ToggleRow label={translate("Never reply to my saved contacts")} value={cfg.skipSavedContacts} onChange={(v) => patch({ skipSavedContacts: v })} />
              <ToggleRow label={translate("Answer my old unanswered DMs (one per scan)")} value={cfg.backlogEnabled} onChange={(v) => patch({ backlogEnabled: v })} />
              <ToggleRow label={translate("Greeting on first message (time-based)")} value={cfg.greetingEnabled} onChange={(v) => patch({ greetingEnabled: v })} />
            </div>

            {cfg.backlogEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-0.5 block text-[10px] text-text-muted">{translate("Scan interval (seconds, 20–600)")}</span>
                  <input
                    type="number" min="20" max="600"
                    value={cfg.backlogIntervalSec ?? 60}
                    onChange={(e) => patch({ backlogIntervalSec: Number(e.target.value) })}
                    dir="ltr"
                    className="w-full rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40"
                  />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[10px] text-text-muted">{translate("Only messages newer than N days")}</span>
                  <input
                    type="number" min="1" max="90"
                    value={cfg.backlogDays ?? 30}
                    onChange={(e) => patch({ backlogDays: Number(e.target.value) })}
                    dir="ltr"
                    className="w-full rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40"
                  />
                </label>
              </div>
            )}

            {cfg.greetingEnabled && (
              <div className="grid grid-cols-2 gap-2">
                {[["greetingMorning", translate("Morning")], ["greetingNoon", translate("Noon / day")], ["greetingEvening", translate("Evening / night")], ["greetingDawn", translate("After midnight")]].map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="mb-0.5 block text-[10px] text-text-muted">{label}</span>
                    <input
                      value={cfg[k] || ""}
                      onChange={(e) => patch({ [k]: e.target.value })}
                      dir="auto"
                      className="w-full rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-text-muted">{translate("Time zone")}</span>
                <input value={cfg.timeZone || ""} onChange={(e) => patch({ timeZone: e.target.value })} dir="ltr" className="w-full rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40" />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] text-text-muted">{translate("Blacklist (@user or id, one per line)")}</span>
                <textarea
                  rows={2}
                  value={(cfg.blacklist || []).join("\n")}
                  onChange={(e) => patch({ blacklist: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                  dir="ltr"
                  className="w-full resize-none rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40 custom-scrollbar"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
              <span className="min-w-0 flex-1 text-xs text-text-muted">
                {translate("Answer only messages newer than activation time")}
                {cfg.activeSince ? ` (${new Date(cfg.activeSince).toLocaleString()})` : ""}
              </span>
              <button
                onClick={() => runAction("activate-now").then(() => load())}
                disabled={busy}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-main transition hover:bg-surface-2"
              >
                {translate("Activate now")}
              </button>
              <button
                onClick={async () => {
                  const r = await runAction("backlog-scan");
                  if (!r) return;
                  let key;
                  if (r.processed) key = translate("Drafted a reply for") + " " + r.processed;
                  else if ((r.found || 0) > 0) key = translate("Unanswered messages found but drafting failed — check the model/quota");
                  else key = translate("No unanswered messages found");
                  setMsg(key);
                }}
                disabled={busy}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-main transition hover:bg-surface-2"
              >
                {translate("Scan unanswered now")}
              </button>
            </div>

            {/* pending drafts — edit before sending */}
            {status.connected && drafts.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-text-muted">{translate("Pending drafts")} ({drafts.length})</p>
                  <button
                    type="button"
                    onClick={() => runAction("bot-cleanup").then((r) => { if (r?.ok) setMsg(translate("Old bot cards deleted") + ": " + r.deleted); load(); })}
                    disabled={busy}
                    className="shrink-0 rounded-lg border border-border px-2 py-0.5 text-[10px] text-text-muted transition hover:bg-surface-2"
                  >
                    {translate("Clean old cards from bot")}
                  </button>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto custom-scrollbar">
                  {drafts.map((d) => (
                    <div key={d.id} className="rounded-lg border border-border bg-white dark:bg-surface p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-text-main">{d.name}{d.username ? ` (@${d.username})` : ""}</span>
                        <span className="shrink-0 text-[10px] text-text-muted">{new Date(d.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="line-clamp-2 text-[11px] text-text-muted" dir="auto">«{d.incoming}»</p>
                      <textarea
                        value={draftTexts[d.id] ?? d.draft}
                        onChange={(e) => setDraftTexts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        rows={3}
                        dir="auto"
                        placeholder={translate("Edit the reply before sending…")}
                        className="w-full resize-none rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40 custom-scrollbar"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => resolveDraft(d, true)} disabled={busy}>{translate("Approve & send")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => resolveDraft(d, false)} disabled={busy} className="text-red-600 dark:text-red-400">{translate("Reject")}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* conversations — edit the last sent message in place */}
            {status.connected && chats.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                <button type="button" onClick={() => setShowChats((v) => !v)} className="flex w-full items-center justify-between text-xs font-medium text-text-muted">
                  <span>{translate("Conversations")} ({chats.length})</span>
                  <span className="material-symbols-outlined text-[16px]">{showChats ? "expand_less" : "expand_more"}</span>
                </button>
                {showChats && (
                  <div className="max-h-60 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {chats.map((c) => (
                      <div key={c.chatId} className="space-y-1 rounded-lg bg-surface-2/60 px-2 py-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <b className="truncate text-text-main">{c.name}</b>
                          <span className="shrink-0 text-[10px] text-text-muted">✓{c.approved}/{c.total}</span>
                        </div>
                        {c.lastMe && (
                          editingMsg?.chatId === c.chatId && editingMsg?.tgId === c.lastMe.tgId ? (
                            <div className="space-y-1">
                              <textarea
                                value={editingMsg.text}
                                onChange={(e) => setEditingMsg({ ...editingMsg, text: e.target.value })}
                                rows={3}
                                dir="auto"
                                className="w-full resize-none rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 outline-none focus:border-primary/40 custom-scrollbar"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={saveSentEdit} disabled={busy || !editingMsg.text.trim()}>{translate("Update in Telegram")}</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingMsg(null)}>{translate("Cancel")}</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-1.5">
                              <p className="min-w-0 flex-1 line-clamp-2 text-text-muted" dir="auto">{translate("Last reply")}: {c.lastMe.text}</p>
                              {c.lastMe.tgId && (
                                <button
                                  type="button"
                                  onClick={() => setEditingMsg({ chatId: c.chatId, tgId: c.lastMe.tgId, text: c.lastMe.text })}
                                  className="mt-0.5 shrink-0 rounded-md p-0.5 text-text-muted hover:bg-primary/10 hover:text-primary"
                                  title={translate("Edit sent message")}
                                >
                                  <span className="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* learned notes — auto-extracted facts from chats */}
            {memories.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-text-muted">{translate("Learned notes")} ({memories.length})</p>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await runAction("memory-clear");
                      if (r) setMemories([]);
                    }}
                    disabled={busy}
                    className="text-[10px] text-red-500 hover:underline"
                  >
                    {translate("Clear all")}
                  </button>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto custom-scrollbar">
                  {memories.map((m) => (
                    <div key={m.id} className="flex items-start gap-2 rounded-lg bg-surface-2/60 px-2 py-1 text-xs">
                      <span className="material-symbols-outlined mt-0.5 shrink-0 text-[14px] text-text-muted">psychology</span>
                      <span className="min-w-0 flex-1 text-text-main" dir="auto">{m.text}</span>
                      <button
                        type="button"
                        onClick={() => runAction("memory-delete", { id: m.id }).then((r) => { if (r) setMemories((prev) => prev.filter((x) => x.id !== m.id)); })}
                        className="mt-0.5 shrink-0 text-text-muted hover:text-red-500"
                        title={translate("Forget")}
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* knowledge base */}
            <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
              <p className="text-xs font-medium text-text-muted">{translate("Knowledge base (what it may say)")}</p>

              <div className="flex gap-1">
                {[
                  ["qa", "Q & A", "quiz"],
                  ["doc", "Document", "description"],
                ].map(([kind, label, icon]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setKbKind(kind)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                      kbKind === kind ? "bg-primary/15 text-primary" : "text-text-muted hover:bg-surface-2"
                    )}
                  >
                    <span className="material-symbols-outlined text-[14px]">{icon}</span>
                    {translate(label)}
                  </button>
                ))}
              </div>

              {kb.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto custom-scrollbar">
                  {kb.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 rounded-lg bg-surface-2/60 px-2 py-1 text-xs">
                      <span className="material-symbols-outlined text-[14px] text-text-muted shrink-0 mt-0.5">
                        {item.kind === "doc" ? "description" : "quiz"}
                      </span>
                      <button
                        type="button"
                        onClick={() => editKbItem(item)}
                        className="min-w-0 flex-1 text-start"
                        title={translate("Click to edit")}
                      >
                        <b className="text-text-main">{item.kind === "doc" ? item.title : item.q}</b>
                        <span className="block text-text-muted truncate">
                          {(item.kind === "doc" ? item.content : item.a).slice(0, 90)}
                        </span>
                      </button>
                      <button onClick={() => runAction("kb-delete", { id: item.id }).then(() => setKb(kb.filter((x) => x.id !== item.id)))} className="mt-0.5 text-red-500 shrink-0"><span className="material-symbols-outlined text-[14px]">close</span></button>
                    </div>
                  ))}
                </div>
              )}

              {kbKind === "qa" ? (
                <>
                  <input value={kbItem.q} onChange={(e) => setKbItem({ ...kbItem, q: e.target.value })} placeholder={translate("Example question / topic")} dir="auto" className="w-full rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40" />
                  <textarea value={kbItem.a} onChange={(e) => setKbItem({ ...kbItem, a: e.target.value })} rows={2} placeholder={translate("The verified answer")} dir="auto" className="w-full resize-none rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40 custom-scrollbar" />
                </>
              ) : (
                <>
                  <input value={kbItem.title} onChange={(e) => setKbItem({ ...kbItem, title: e.target.value })} placeholder={translate("Document title (e.g. Company intro)")} dir="auto" className="w-full rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40" />
                  <textarea value={kbItem.content} onChange={(e) => setKbItem({ ...kbItem, content: e.target.value })} rows={10} placeholder={translate("Paste your full text here — catalogs, policies, prices, anything. The system splits it into chunks and feeds the agent only the relevant parts per message.")} dir="auto" className="w-full resize-y rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-xs outline-none focus:border-primary/40 custom-scrollbar min-h-[160px]" />
                </>
              )}

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-text-muted">
                  <input type="checkbox" checked={!!kbItem.pinned} onChange={(e) => setKbItem({ ...kbItem, pinned: e.target.checked })} className="size-3.5 accent-[var(--primary)]" />
                  {kbKind === "qa" ? translate("Always include") : translate("Intro is always included")}
                </label>
                <Button size="sm" variant="secondary" onClick={() => saveKbItem()} disabled={busy} className="ms-auto">
                  {kbItem.id ? translate("Update entry") : translate("Add to base")}
                </Button>
                {kbItem.id && (
                  <Button size="sm" variant="ghost" onClick={() => setKbItem({ kind: kbKind, id: "", q: "", a: "", title: "", content: "", pinned: false })}>
                    {translate("Cancel")}
                  </Button>
                )}
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
            {msg && <p className="text-xs text-emerald-500">{msg}</p>}

            <div className="flex gap-2 pt-1">
              <Button onClick={saveSettings} disabled={busy} className="flex-1">{translate("Save settings")}</Button>
              <Button variant="secondary" onClick={() => runAction("connect").then(() => load())} disabled={busy}>{translate("Reconnect")}</Button>
              {status.connected && (
                <Button variant="secondary" onClick={() => runAction("logout").then(() => load())} disabled={busy} className="text-red-600 dark:text-red-400">{translate("Log out")}</Button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(translate("Invalidate the session and start over?"))) return;
                  runAction("reset").then(() => load());
                }}
                disabled={busy}
                title={translate("Force reset")}
                className="shrink-0 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
              >
                {translate("Force reset")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// __USERBOT_MODAL_PLACEHOLDER__

