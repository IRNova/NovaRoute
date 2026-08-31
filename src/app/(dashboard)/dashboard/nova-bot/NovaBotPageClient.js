"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { translate } from "@/i18n/runtime";
import {
  AgentFormModal,
  SupervisionPanel,
  TaskCard,
  UserMessage,
  AgentMessage,
  TeamSidebar,
} from "./components";

function textValue(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function NovaBotPageClient() {
  const [agents, setAgents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusLine, setStatusLine] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [busyAgents, setBusyAgents] = useState(false);

  const [supervisionOpen, setSupervisionOpen] = useState(false);
  const [stats, setStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);


  const [approvals, setApprovals] = useState({ pending: [], recent: [] });

  const [teamOpenMobile, setTeamOpenMobile] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionResults, setSessionResults] = useState([]);

  // Deep search across stored messages (server-side), debounced lightly.
  useEffect(() => {
    const q = sessionQuery.trim();
    if (q.length < 3) {
      setSessionResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/dashboard/nova/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setSessionResults(Array.isArray(d?.results) ? d.results : []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [sessionQuery]);

  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || "").toLowerCase().includes(q));
  }, [sessions, sessionQuery]);

  const abortRef = useRef(null);
  const timelineRef = useRef(null);
  const sessionsMenuRef = useRef(null);

  /* ---------- data loading ---------- */

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/nova/agents", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(textValue(data.error) || `Failed (${res.status})`);
      setAgents(Array.isArray(data.agents) ? data.agents : []);
      return data.agents || [];
    } catch (error) {
      setLoadError(textValue(error?.message) || translate("Failed to load team"));
      return [];
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/nova/sessions", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(textValue(data.error) || `Failed (${res.status})`);
      const list = Array.isArray(data.sessions) ? data.sessions : [];
      setSessions(list);
      setActiveSessionId((prev) => prev || list[0]?.id || "");
      return list;
    } catch (error) {
      setLoadError(textValue(error?.message) || translate("Failed to load sessions"));
      return [];
    }
  }, []);

  const loadTranscript = useCallback(async (sessionId) => {
    if (!sessionId) {
      setMessages([]);
      setTasks([]);
      return;
    }
    try {
      const res = await fetch(`/api/dashboard/nova/sessions/${sessionId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(textValue(data.error) || `Failed (${res.status})`);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (error) {
      setLoadError(textValue(error?.message) || translate("Failed to load conversation"));
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
    loadAgents();
    loadSessions();
  }, [loadAgents, loadSessions]);

  const loadApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/nova/approvals", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.pending)) {
        setApprovals({ pending: data.pending, recent: Array.isArray(data.recent) ? data.recent : [] });
      }
    } catch { /* polling is best-effort */ }
  }, []);

  const resolveApprovalAction = async (id, action) => {
    try {
      const res = await fetch("/api/dashboard/nova/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(textValue(data.error) || `Failed (${res.status})`);
      setApprovals({ pending: data.pending || [], recent: data.recent || [] });
    } catch (error) {
      setLoadError(textValue(error?.message) || translate("Failed to resolve approval"));
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    loadApprovals();
    const timer = setInterval(loadApprovals, 6000);
    return () => clearInterval(timer);
  }, [hydrated, loadApprovals]);

  useEffect(() => {
    if (!hydrated) return;
    loadTranscript(activeSessionId);
  }, [hydrated, activeSessionId, loadTranscript]);

  useEffect(() => {
    const handler = (event) => {
      if (sessionsMenuRef.current && !sessionsMenuRef.current.contains(event.target)) {
        setSessionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight });
  }, [messages.length, tasks.length, isSending, statusLine]);

  /* ---------- derived ---------- */

  const agentsById = useMemo(() => Object.fromEntries(agents.map((a) => [a.id, a])), [agents]);
  const hasCeo = useMemo(() => agents.some((a) => a.role === "ceo" && a.status === "active"), [agents]);
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const timeline = useMemo(() => {
    const items = [
      ...messages.map((m) => ({ kind: "message", at: m.createdAt, id: m.id, message: m })),
      ...tasks.map((t) => ({ kind: "task", at: t.createdAt, id: t.id, task: t })),
    ];
    return items.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  }, [messages, tasks]);

  /* ---------- agent CRUD ---------- */

  const openAdd = () => { setEditingAgent(null); setFormOpen(true); };
  const openEdit = (agent) => { setEditingAgent(agent); setFormOpen(true); };

  const saveAgent = async (form) => {
    setBusyAgents(true);
    try {
      const url = editingAgent
        ? `/api/dashboard/nova/agents/${editingAgent.id}`
        : "/api/dashboard/nova/agents";
      const res = await fetch(url, {
        method: editingAgent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(textValue(data.error) || `Failed (${res.status})`);
      setFormOpen(false);
      setEditingAgent(null);
      await loadAgents();
    } catch (error) {
      setLoadError(textValue(error?.message) || translate("Failed to save member"));
    } finally {
      setBusyAgents(false);
    }
  };

  const deleteAgent = async (agent) => {
    if (!globalThis.confirm(`${translate("Delete")} ${agent.name}?`)) return;
    setBusyAgents(true);
    try {
      const res = await fetch(`/api/dashboard/nova/agents/${agent.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(textValue(data.error) || `Failed (${res.status})`);
      }
      await loadAgents();
    } catch (error) {
      setLoadError(textValue(error?.message) || translate("Failed to delete member"));
    } finally {
      setBusyAgents(false);
    }
  };

  /* ---------- supervision stats ---------- */

  const openSupervision = async () => {
    setSupervisionOpen(true);
    setStatsLoading(true);
    try {
      const res = await fetch("/api/dashboard/nova/stats", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStats(Array.isArray(data.stats) ? data.stats : []);
    } finally {
      setStatsLoading(false);
    }
  };

  /* ---------- chat ---------- */

  const applyEvent = (event) => {
    if (event.type === "message" && event.message) {
      setMessages((prev) => {
        let next = prev;
        // Replace the optimistic bubble once the persisted user message arrives.
        if (event.message.role === "user") {
          const optimisticIndex = next.findIndex(
            (m) => m.id.startsWith("local_") && m.role === "user" && m.content === event.message.content
          );
          if (optimisticIndex !== -1) {
            next = next.filter((_, i) => i !== optimisticIndex);
          }
        }
        return next.some((m) => m.id === event.message.id) ? prev : [...next, event.message];
      });
    } else if (event.type === "review" && event.message) {
      setMessages((prev) => prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]);
    } else if (event.type === "task" && event.task) {
      setTasks((prev) => prev.some((t) => t.id === event.task.id) ? prev : [...prev, event.task]);
    } else if (event.type === "task_update" && event.task) {
      setTasks((prev) => prev.map((t) => (t.id === event.task.id ? event.task : t)));
    } else if (event.type === "status") {
      setStatusLine(event);
    } else if (event.type === "approval") {
      loadApprovals();
    } else if (event.type === "done") {
      setStatusLine(null);
    } else if (event.type === "error") {
      setStatusLine(null);
      setLoadError(textValue(event.error) || translate("Nova turn failed"));
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    setDraft("");
    setIsSending(true);
    setLoadError("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Optimistic user bubble.
    const optimistic = {
      id: `local_${Date.now()}`,
      sessionId: activeSessionId,
      role: "user",
      type: "message",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        const res = await fetch("/api/dashboard/nova/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text.slice(0, 60) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(textValue(data.error) || "Failed to create session");
        sessionId = data.session.id;
        setActiveSessionId(sessionId);
        setSessions((prev) => [data.session, ...prev]);
        setMessages([]);
        setTasks([]);
      }

      const response = await fetch("/api/dashboard/nova/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ sessionId, text }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(textValue(errorData.error) || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            applyEvent(JSON.parse(payload));
          } catch { /* ignore malformed chunk */ }
        }
      }

      loadSessions();
    } catch (error) {
      try {
        fetch("/api/dashboard/nova/client-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "send-handler",
            message: error?.message,
            stack: (error?.stack || "").split("\n").slice(0, 8).join("\n"),
            url: window.location.href,
            at: new Date().toISOString(),
          }),
        }).catch(() => {});
      } catch {}
      if (error.name !== "AbortError") {
        setLoadError(textValue(error?.message) || translate("Nova turn failed"));
      }
    } finally {
      setIsSending(false);
      setStatusLine(null);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const newMission = async () => {
    try {
      const res = await fetch("/api/dashboard/nova/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(textValue(data.error) || "Failed");
      setSessions((prev) => [data.session, ...prev]);
      setActiveSessionId(data.session.id);
      setMessages([]);
      setTasks([]);
      setSessionsOpen(false);
    } catch (error) {
      setLoadError(textValue(error?.message) || translate("Failed to create session"));
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      const res = await fetch(`/api/dashboard/nova/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) return;
      const next = sessions.filter((s) => s.id !== sessionId);
      setSessions(next);
      if (sessionId === activeSessionId) {
        setActiveSessionId(next[0]?.id || "");
      }
    } catch { /* ignore */ }
  };

  const canSend = !isSending && draft.trim().length > 0;

  return (
    <div className="relative flex flex-1 h-full min-h-0 min-w-0 bg-bg text-text-main overflow-hidden">
      {/* Team sidebar — desktop */}
      <aside className="hidden lg:flex w-72 shrink-0 border-e border-border-subtle bg-surface/60 backdrop-blur-xl">
        <TeamSidebarInner
          agents={agents}
          busy={busyAgents}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={deleteAgent}
        />
      </aside>

      {/* Team sidebar — mobile slide-over */}
      {teamOpenMobile && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setTeamOpenMobile(false)} />
          <div className="fixed inset-y-0 start-0 z-[56] w-80 max-w-[85vw] bg-bg border-e border-border-subtle shadow-2xl lg:hidden">
            <TeamSidebarInner
              agents={agents}
              busy={busyAgents}
              onAdd={() => { setTeamOpenMobile(false); openAdd(); }}
              onEdit={(a) => { setTeamOpenMobile(false); openEdit(a); }}
              onDelete={deleteAgent}
              onClose={() => setTeamOpenMobile(false)}
            />
          </div>
        </>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 border-b border-border-subtle bg-surface/80 backdrop-blur-xl z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setTeamOpenMobile(true)}
              className="lg:hidden p-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-2"
            >
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </button>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]">hub</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-main leading-tight">{translate("Nova Bot")}</p>
              <p className="truncate text-[11px] text-text-muted">
                {hasCeo ? translate("Your AI company is ready") : translate("Create a CEO to get started")}
              </p>
            </div>

            <div ref={sessionsMenuRef} className="relative ms-2">
              <button
                type="button"
                onClick={() => setSessionsOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 h-8 text-xs font-medium text-text-main hover:bg-surface-2 max-w-[180px]"
              >
                <span className="material-symbols-outlined text-[15px] text-text-muted">forum</span>
                <span className="truncate" dir="auto">{activeSession?.title || translate("Missions")}</span>
                <span className="material-symbols-outlined text-[14px] text-text-muted">expand_more</span>
              </button>
              {sessionsOpen && (
                <div className="absolute start-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-border-subtle bg-white dark:bg-surface shadow-2xl p-2">
                  <button
                    type="button"
                    onClick={newMission}
                    className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    {translate("New mission")}
                  </button>
                  <input
                    type="text"
                    value={sessionQuery}
                    onChange={(e) => setSessionQuery(e.target.value)}
                    placeholder={translate("Search sessions and messages…")}
                    className="mb-1 w-full rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {sessionResults.length > 0 && (
                    <div className="mb-1 max-h-40 overflow-y-auto custom-scrollbar rounded-lg bg-surface-2/60 p-1">
                      <p className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{translate("Message matches")}</p>
                      {sessionResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { setActiveSessionId(r.sessionId); setSessionsOpen(false); }}
                          className="block w-full rounded-md px-1.5 py-1.5 text-start hover:bg-primary/10"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] font-medium text-text-main" dir="auto">{r.sessionTitle || translate("Untitled mission")}</span>
                            <span className="text-[9px] text-text-muted">{r.role}</span>
                          </span>
                          <span className="block truncate text-[10px] text-text-muted" dir="auto">{r.excerpt}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {filteredSessions.length === 0 && sessionResults.length === 0 && (
                      <p className="px-2.5 py-3 text-xs text-text-muted">{translate("No missions yet.")}</p>
                    )}
                    {filteredSessions.map((s) => (
                      <div key={s.id} className="group flex items-center gap-1 rounded-lg hover:bg-surface-2">
                        <button
                          type="button"
                          onClick={() => { setActiveSessionId(s.id); setSessionsOpen(false); }}
                          className={cn(
                            "min-w-0 flex-1 px-2.5 py-2 text-start text-xs",
                            s.id === activeSessionId ? "font-semibold text-primary" : "text-text-main"
                          )}
                          dir="auto"
                        >
                          <span className="block truncate">{s.title || translate("Untitled mission")}</span>
                          <span className="block truncate text-[10px] text-text-muted">{new Date(s.updatedAt).toLocaleString()}</span>
                        </button>
                        <a
                          href={`/api/dashboard/nova/sessions/${s.id}?format=md`}
                          download
                          className="p-1.5 text-text-muted opacity-0 group-hover:opacity-100 hover:text-primary"
                          title={translate("Export as Markdown")}
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteSession(s.id)}
                          className="p-1.5 text-text-muted opacity-0 group-hover:opacity-100 hover:text-red-500"
                          title={translate("Delete")}
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href="/dashboard/nova-bot/tools"
              title={translate("Nova tools & integrations")}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-text-main transition hover:bg-surface-2"
            >
              <span className="material-symbols-outlined text-[17px] text-text-muted">tune</span>
              <span className="hidden sm:inline">{translate("Tools")}</span>
            </a>
            <Button
              variant="ghost"
              size="sm"
              icon="monitoring"
              onClick={openSupervision}
              title={translate("Supervision room")}
            >
              <span className="hidden sm:inline">{translate("Supervision")}</span>
            </Button>
          </div>
        </div>

        {/* Error */}
        {loadError && (
          <div className="shrink-0 px-4 pt-3">
            <div className="mx-auto max-w-3xl rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
              <span className="flex-1" dir="auto">{loadError}</span>
              <button onClick={() => setLoadError("")} className="text-current opacity-70 hover:opacity-100">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div ref={timelineRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {timeline.length === 0 ? (
            <EmptyState hasCeo={hasCeo} agentCount={agents.length} />
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
              {timeline.map((item) =>
                item.kind === "message" ? (
                  item.message.role === "user" ? (
                    <UserMessage key={item.id} message={item.message} />
                  ) : (
                    <AgentMessage key={item.id} message={item.message} agentsById={agentsById} />
                  )
                ) : (
                  <TaskCard key={item.id} task={item.task} agentsById={agentsById} />
                )
              )}
              {statusLine && (
                <div className="flex items-center gap-2 px-2 text-xs text-text-muted">
                  <span className="material-symbols-outlined text-[16px] animate-spin text-primary">progress_activity</span>
                  <span dir="auto">
                    <b className="text-text-main">{statusLine.agentName}</b>{" "}
                    {statusLine.phase === "thinking" && translate("is thinking…")}
                    {statusLine.phase === "reviewing" && translate("is reviewing the delivered work…")}
                    {statusLine.phase === "reporting" && translate("is preparing the final report…")}
                    {statusLine.phase === "tool" && `${translate("is running a system tool…")} ${statusLine.note || ""}`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border-subtle bg-surface/80 backdrop-blur-xl px-4 py-3">
          <div className="mx-auto w-full max-w-3xl">
            {approvals.pending.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {approvals.pending.map((p) => (
                  <div
                    key={p.id}
                    dir="ltr"
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-500">terminal</span>
                    <code className="min-w-0 flex-1 truncate font-mono text-text-main" title={p.command}>{p.command}</code>
                    <span className="shrink-0 rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] text-text-muted">{p.agentName}</span>
                    <button
                      type="button"
                      onClick={() => resolveApprovalAction(p.id, "approve")}
                      className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 font-medium text-white transition hover:bg-emerald-500"
                    >
                      {translate("Approve")}
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveApprovalAction(p.id, "deny")}
                      className="shrink-0 rounded-lg border border-red-500/40 px-2.5 py-1 font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                    >
                      {translate("Deny")}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!hasCeo && (
              <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                <span className="material-symbols-outlined text-[15px]">info</span>
                {translate("Add an active CEO agent (e.g. Max) from the Team panel so Nova Bot can answer.")}
              </p>
            )}
            <div className="rounded-[22px] bg-surface border border-border-subtle px-3 py-2 shadow-sm focus-within:border-primary/40 transition-all flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={translate("Give your company a task… (use @name to talk to one member directly)")}
                rows={1}
                dir="auto"
                disabled={isSending}
                className="max-h-[25vh] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-text-main outline-none placeholder:text-text-muted custom-scrollbar disabled:opacity-60"
              />
              {isSending ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="h-9 w-9 shrink-0 rounded-full border border-border bg-surface-2 text-text-main transition hover:bg-surface-3 flex items-center justify-center"
                  title={translate("Stop")}
                >
                  <span className="material-symbols-outlined text-[16px]">stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!canSend}
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition",
                    canSend
                      ? "bg-primary text-on-primary hover:opacity-90 shadow-sm"
                      : "bg-surface-2 text-text-muted cursor-not-allowed"
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                </button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[11px] text-text-muted">
              {translate("Every delegation, result and supervisor review is stored permanently.")}
            </p>
          </div>
        </div>
      </div>

      {/* Modals & panels */}
      <AgentFormModal
        open={formOpen}
        editing={editingAgent}
        busy={busyAgents}
        onClose={() => { setFormOpen(false); setEditingAgent(null); }}
        onSave={saveAgent}
      />
      <SupervisionPanel
        open={supervisionOpen}
        stats={stats}
        loading={statsLoading}
        onClose={() => setSupervisionOpen(false)}
      />
    </div>
  );
}

function TeamSidebarInner({ agents, busy, onAdd, onEdit, onDelete, onClose }) {
  return (
    <div className="flex w-full flex-col">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="self-end m-2 p-1 rounded-lg text-text-muted hover:text-text-main lg:hidden"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      )}
      <TeamSidebar agents={agents} busy={busy} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function EmptyState({ hasCeo, agentCount }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="max-w-md space-y-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[32px]">hub</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-main">{translate("Meet your AI company")}</h2>
          <p className="text-sm leading-6 text-text-muted" dir="auto">
            {translate("Send a mission — the CEO plans it, employees execute it, and the supervisor checks the quality. Watch everything happen live.")}
          </p>
        </div>
        {!hasCeo && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined text-[15px]">workspace_premium</span>
            {agentCount === 0
              ? translate("Step 1: open the Team panel and add your CEO.")
              : translate("Step 2: make sure a CEO agent is active.")}
          </p>
        )}
      </div>
    </div>
  );
}
