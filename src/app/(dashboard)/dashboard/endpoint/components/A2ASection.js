"use client";
import { useState, useEffect } from "react";
import NotImplementedNotice from "@/shared/components/NotImplementedNotice";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import { translate } from "@/i18n/runtime";

const SAMPLE_AGENTS = [
  { id: "local-agent", name: translate("Local Agent"), capabilities: ["chat", "code", "search"], status: "online", enabled: true, description: translate("Main NovaRoute agent") },
  { id: "code-agent", name: translate("Code Agent"), capabilities: ["code", "review"], status: "online", enabled: true, description: translate("Specialized code generation") },
];

const CAPABILITY_COLORS = {
  chat: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  code: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  search: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  review: "bg-green-500/10 text-green-600 dark:text-green-400",
  default: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export default function A2ASection() {
  const [wired, setWired] = useState(true);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", capabilities: "", description: "" });

  useEffect(() => {
    fetch("/api/a2a")
      .then((r) => r.json())
      .then((d) => { setWired(d.implemented !== false); setAgents(d.agents || SAMPLE_AGENTS); setLoading(false); })
      .catch(() => { setAgents(SAMPLE_AGENTS); setLoading(false); });
  }, []);

  const handleAdd = async () => {
    const agent = { ...newAgent, id: Date.now().toString(), capabilities: newAgent.capabilities.split(",").map((c) => c.trim()).filter(Boolean), status: "online", enabled: true };
    setAgents([...agents, agent]);
    setShowAdd(false);
    setNewAgent({ name: "", capabilities: "", description: "" });
    try { await fetch("/api/a2a", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(agent) }); } catch { /* fail-open */ }
  };

  const handleToggle = async (id, enabled) => {
    setAgents(agents.map((a) => a.id === id ? { ...a, enabled } : a));
    try { await fetch(`/api/a2a/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) }); } catch { /* fail-open */ }
  };

  const handleRemove = async (id) => {
    setAgents(agents.filter((a) => a.id !== id));
    try { await fetch(`/api/a2a/${id}`, { method: "DELETE" }); } catch { /* fail-open */ }
  };

  const onlineCount = agents.filter((a) => a.status === "online").length;
  const totalCapabilities = new Set(agents.flatMap((a) => a.capabilities || [])).size;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-brand-lg border border-border bg-surface p-5">
        <div className="relative z-10 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand bg-primary/15 text-primary">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">group_add</span>
          </div>
          <div className="max-w-2xl">
            <h3 className="text-base font-semibold text-text-main mb-1">{translate("A2A Agents")}</h3>
            <p className="text-sm leading-relaxed text-text-muted">
              {translate("Manage Agent-to-Agent communication capabilities")}
            </p>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs">
        <span className="font-semibold text-text-main">{translate("Status")}:</span>
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="size-2.5 rounded-full bg-green-500" />
          <span className="tabular-nums font-semibold text-text-main">{onlineCount}</span>
          {translate("online")}
        </span>
        <span className="text-text-muted">·</span>
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="tabular-nums font-semibold text-text-main">{agents.length}</span>
          {translate("total")}
        </span>
        <span className="text-text-muted">·</span>
        <span className="inline-flex items-center gap-1.5 text-text-muted">
          <span className="material-symbols-outlined text-[14px]">extension</span>
          <span className="tabular-nums font-semibold text-text-main">{totalCapabilities}</span>
          {translate("capabilities")}
        </span>
      </div>

      {/* Agent list */}
      <Card className="p-5 space-y-4">
        {!wired && <NotImplementedNotice feature="A2A registry" />}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-main">{translate("Configured Agents")}</h4>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? translate("Cancel") : translate("+ Add Agent")}
          </Button>
        </div>

        {showAdd && (
          <div className="p-4 rounded-xl border border-border space-y-3 bg-surface-2/30">
            <Input placeholder={translate("Agent name")} value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} />
            <Input placeholder={translate("Capabilities (comma-separated: chat, code, search)")} value={newAgent.capabilities} onChange={(e) => setNewAgent({ ...newAgent, capabilities: e.target.value })} />
            <Input placeholder={translate("Description")} value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })} />
            <Button size="sm" onClick={handleAdd} disabled={!newAgent.name}>{translate("Add Agent")}</Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <span className="material-symbols-outlined text-[24px] text-text-muted animate-spin">progress_activity</span>
            <p className="text-xs text-text-muted">{translate("Loading")}...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">group_add</span>
            <p className="text-sm text-text-muted">{translate("No A2A agents configured")}</p>
            <p className="text-xs text-text-muted mt-1">{translate("Add an agent to enable A2A communication")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/40 hover:bg-surface-2/60 transition-colors">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-main text-sm">{a.name}</span>
                    <Badge variant={a.status === "online" ? "success" : "default"} size="sm">{a.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(a.capabilities || []).map((c) => (
                      <span key={c} className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CAPABILITY_COLORS[c] || CAPABILITY_COLORS.default}`}>
                        {c}
                      </span>
                    ))}
                  </div>
                  {a.description && <p className="text-xs text-text-muted mt-1 truncate">{a.description}</p>}
                </div>
                <Toggle checked={a.enabled ?? false} onChange={(v) => handleToggle(a.id, v)} />
                <Button size="sm" variant="ghost" onClick={() => handleRemove(a.id)}>
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Info card */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">info</span>
          <div className="text-xs text-text-muted leading-relaxed">
            <p className="font-medium text-text-main mb-1">{translate("What is A2A?")}</p>
            <p>{translate("Agent-to-Agent (A2A) protocol enables AI agents to communicate and collaborate. Register agents here to expose their capabilities to other agents in your network.")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
