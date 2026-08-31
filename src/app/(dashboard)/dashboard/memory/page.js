"use client";
import { translate } from "@/i18n/runtime";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import Select from "@/shared/components/Select";

const TABS = [
  { id: "engine", label: translate("Engine"), icon: "settings" },
  { id: "memories", label: translate("Memories"), icon: "memory" },
  { id: "playground", label: translate("Playground"), icon: "stylus" },
];

export default function MemoryPage() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("engine");
  const [engine, setEngine] = useState({ provider: "qdrant", enabled: true, topK: 5, rerank: false });
  const [query, setQuery] = useState("");
  const [retrieveResult, setRetrieveResult] = useState(null);
  const [newMemory, setNewMemory] = useState("");

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => { setMemories(d.memories || []); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => { if (s?.memory) setEngine((prev) => ({ ...prev, ...s.memory })); })
      .catch(() => {});
  }, []);

  const handleSaveEngine = () => {
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory: engine }),
    }).catch(() => {});
  };

  const handleRetrieve = async () => {
    if (!query) return;
    const res = await fetch("/api/memory/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, topK: engine.topK }),
    });
    const data = await res.json();
    setRetrieveResult(data.results || []);
  };

  const handleAddMemory = () => {
    if (!newMemory.trim()) return;
    fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMemory }),
    })
      .then((r) => r.json())
      .then((d) => { setMemories([d.memory, ...memories]); setNewMemory(""); })
      .catch(() => {});
  };

  const filtered = search ? memories.filter((m) => (m.content || "").toLowerCase().includes(search.toLowerCase())) : memories;

  if (loading) return <div className="p-6"><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">{translate("Memory")}</h1>
          <p className="text-sm text-text-muted mt-1">{translate("Persistent conversation memory across sessions")}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-3">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text-main"}`}>
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "engine" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">{translate("Memory Engine")}</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-main">{translate("Enable memory")}</span>
              <Toggle checked={engine.enabled} onChange={(v) => setEngine({ ...engine, enabled: v })} />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Provider</label>
              <Select options={[{ value: "qdrant", label: "Qdrant" }, { value: "sqlite", label: "SQLite FTS" }]} value={engine.provider} onChange={(e) => setEngine({ ...engine, provider: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Top-K retrieved</label>
              <Input type="number" value={engine.topK} onChange={(e) => setEngine({ ...engine, topK: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-main">Rerank results</span>
              <Toggle checked={engine.rerank} onChange={(v) => setEngine({ ...engine, rerank: v })} />
            </div>
            <Button size="sm" onClick={handleSaveEngine}>Save Engine Config</Button>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-main">{translate("Vector Store")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-3/50"><p className="text-xs text-text-muted">Collection</p><p className="text-sm font-semibold text-text-main mt-1">memory</p></div>
              <div className="p-3 rounded-xl bg-surface-3/50"><p className="text-xs text-text-muted">Vectors</p><p className="text-sm font-semibold text-text-main mt-1">{memories.length}</p></div>
              <div className="p-3 rounded-xl bg-surface-3/50"><p className="text-xs text-text-muted">Dimension</p><p className="text-sm font-semibold text-text-main mt-1">1536</p></div>
              <div className="p-3 rounded-xl bg-surface-3/50"><p className="text-xs text-text-muted">Status</p><p className="text-sm font-semibold text-success mt-1">Active</p></div>
            </div>
          </Card>
        </div>
      )}

      {tab === "memories" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder={translate("Search memories...")} value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
          </div>
          <div className="flex gap-2">
            <Input placeholder={translate("Add a new memory...")} value={newMemory} onChange={(e) => setNewMemory(e.target.value)} className="flex-1" />
            <Button onClick={handleAddMemory}>Add</Button>
          </div>
          {filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-text-muted mb-3">memory</span>
              <p className="text-sm text-text-muted">No memories stored yet. Memories are created as you chat.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((m, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-text-main flex-1">{m.content || "—"}</p>
                    <Badge size="sm">{m.type || "general"}</Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-2">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "playground" && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-main">{translate("Retrieve Preview")}</h3>
          <div className="flex gap-2">
            <Input placeholder={translate("Enter a query to retrieve relevant memories...")} value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1" />
            <Button onClick={handleRetrieve}>Retrieve</Button>
          </div>
          {retrieveResult && (
            <div className="space-y-2">
              {retrieveResult.length === 0 ? <p className="text-sm text-text-muted">No relevant memories found.</p> : retrieveResult.map((r, i) => (
                <div key={i} className="p-3 rounded-xl bg-surface-3/30">
                  <p className="text-sm text-text-main">{r.content}</p>
                  <p className="text-xs text-text-muted mt-1">Score: {r.score?.toFixed(3) || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
