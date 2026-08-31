"use client";

import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { translate } from "@/i18n/runtime";

/**
 * Ollama Local model manager: browse the curated catalog + installed models,
 * download (pull) with live progress, and delete — all without a terminal.
 */
export default function OllamaModelsPanel({ onModelsChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [pulls, setPulls] = useState({});
  const [message, setMessage] = useState(null);
  const pullsRef = useRef({});

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/local/ollama/models", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      setData({ running: false, installed: [], catalog: [], error: "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const setPullState = (model, patch) => {
    setPulls((prev) => {
      const next = { ...prev, [model]: { ...(prev[model] || {}), ...patch } };
      pullsRef.current = next;
      return next;
    });
  };

  const pullModel = async (rawModel) => {
    const model = String(rawModel || "").trim();
    if (!model || pullsRef.current?.[model]?.active) return;
    setMessage(null);
    setPullState(model, { active: true, percent: 0, status: "starting", error: "" });
    try {
      const res = await fetch("/api/local/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          msg = j.error || msg;
        } catch {}
        setPullState(model, { active: false, error: msg });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt = null;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.error) {
            setPullState(model, { active: false, error: evt.error });
            return;
          }
          if (evt.status === "success") {
            done = true;
            setPullState(model, { active: false, percent: 100, status: "done" });
            break;
          }
          if (typeof evt.total === "number" && typeof evt.completed === "number" && evt.total > 0) {
            setPullState(model, {
              percent: Math.min(99, Math.round((evt.completed / evt.total) * 100)),
              status: evt.status,
            });
          } else if (evt.status) {
            setPullState(model, { status: evt.status });
          }
        }
      }
      if (!done && pullsRef.current?.[model]?.active !== false) {
        // Stream ended without an explicit success line — treat as done only if no error was recorded.
        const state = pullsRef.current?.[model];
        if (state && !state.error) setPullState(model, { active: false, percent: 100, status: "done" });
      }

      const finalState = pullsRef.current?.[model];
      if (finalState?.status === "done" && !finalState.error) {
        setMessage({ type: "ok", text: `${model} ${translate("downloaded successfully")}` });
        await fetchModels();
        if (onModelsChanged) onModelsChanged(model);
      }
    } catch (err) {
      setPullState(model, { active: false, error: String(err?.message || err) });
    }
  };

  const deleteModel = async (model) => {
    if (!window.confirm(`${translate("Delete model")} ${model}?`)) return;
    try {
      const res = await fetch("/api/local/ollama/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: `${model} ${translate("deleted")}` });
        await fetchModels();
      } else {
        setMessage({ type: "error", text: json.error || `HTTP ${res.status}` });
      }
    } catch (err) {
      setMessage({ type: "error", text: String(err?.message || err) });
    }
  };

  const q = search.trim().toLowerCase();
  const catalog = useMemo(() => {
    const list = data?.catalog || [];
    if (!q) return list;
    return list.filter((m) => `${m.name} ${m.label} ${m.about}`.toLowerCase().includes(q));
  }, [data, q]);

  const installedRows = useMemo(() => {
    const list = data?.installed || [];
    if (!q) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [data, q]);

  const anyPulling = Object.values(pulls).some((p) => p.active);

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="material-symbols-outlined text-primary text-2xl shrink-0">cloud_download</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-lg">{translate("Ollama Models")}</h3>
            <p className="text-sm text-text-muted">{translate("Browse, download and manage models without the terminal.")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!data?.running ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500">
              <span className="material-symbols-outlined text-[13px]">cancel</span>
              {translate("Ollama is not running")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              {(data.installed || []).length} {translate("installed")}
            </span>
          )}
          <button
            onClick={fetchModels}
            disabled={anyPulling}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-primary hover:border-primary/40 disabled:opacity-50"
            title={translate("Refresh")}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {translate("Refresh")}
          </button>
        </div>
      </div>

      {message && (
        <p className={`mb-3 flex items-center gap-1.5 text-xs ${message.type === "ok" ? "text-green-500" : "text-red-500"}`}>
          <span className="material-symbols-outlined text-sm">{message.type === "ok" ? "task_alt" : "error"}</span>
          {message.text}
        </p>
      )}

      {!data?.running ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <span className="material-symbols-outlined text-[28px] text-text-muted">dns</span>
          <p className="text-sm text-text-muted">{data?.error || translate("Ollama is not running")}</p>
          <p className="text-xs text-text-muted">{translate("Use the Install & Configure button above to install and start Ollama first.")}</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${translate("Search models")}...`}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none sm:max-w-xs"
            />
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (customModel.trim()) {
                  pullModel(customModel.trim());
                  setCustomModel("");
                }
              }}
            >
              <input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder={`${translate("Custom tag, e.g.")} llama3.2:3b`}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs focus:border-primary focus:outline-none sm:w-56"
              />
              <button
                type="submit"
                disabled={anyPulling || !customModel.trim()}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                {translate("Pull")}
              </button>
            </form>
          </div>

          {installedRows.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-text-muted">{translate("Installed models")}</p>
              <div className="flex flex-wrap gap-2">
                {installedRows.map((m) => {
                  const pull = pulls[m.name];
                  return (
                    <div key={m.name} className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-2.5 py-1.5">
                      <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>
                      <span className="font-mono text-xs text-text-main">{m.name}</span>
                      {m.parameterSize && <span className="text-[10px] text-text-muted">{m.parameterSize}</span>}
                      {formatSize(m.size) && <span className="text-[10px] text-text-muted">{formatSize(m.size)}</span>}
                      {pull?.active ? (
                        <span className="material-symbols-outlined animate-spin text-[14px] text-primary">progress_activity</span>
                      ) : (
                        <button
                          onClick={() => deleteModel(m.name)}
                          className="text-text-muted transition-colors hover:text-red-500"
                          title={translate("Delete model")}
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mb-2 text-xs font-medium text-text-muted">{translate("Available to download")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((m) => {
              const pull = pulls[m.name];
              const pulling = pull?.active;
              return (
                <div key={m.name} className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-main">{m.label}</p>
                      <p className="font-mono text-[11px] text-text-muted">{m.name}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-text-muted dark:bg-white/10">
                      {m.size}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-text-muted">{m.about}</p>

                  {pull?.active && (
                    <div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.max(4, pull.percent || 0)}%` }}
                        />
                      </div>
                      <p className="mt-1 truncate text-[10px] text-text-muted tabular-nums">
                        {pull.percent > 0 ? `${pull.percent}%` : (pull.status || translate("Starting..."))}
                      </p>
                    </div>
                  )}
                  {pull?.error && (
                    <p className="text-[10px] text-red-500 break-words">{pull.error}</p>
                  )}

                  <div className="mt-auto pt-1">
                    {m.installed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-500">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                        {translate("Installed")}
                      </span>
                    ) : (
                      <button
                        onClick={() => pullModel(m.name)}
                        disabled={pulling || anyPulling}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className={`material-symbols-outlined text-[13px] ${pulling ? "animate-spin" : ""}`}>
                          {pulling ? "progress_activity" : "download"}
                        </span>
                        {pulling ? translate("Downloading...") : translate("Download")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {catalog.length === 0 && (
            <p className="py-4 text-center text-sm text-text-muted">{translate("No models match this filter.")}</p>
          )}
        </>
      )}
    </div>
  );
}

function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  const gb = n / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = n / 1024 ** 2;
  return `${Math.round(mb)} MB`;
}

OllamaModelsPanel.propTypes = {
  onModelsChanged: PropTypes.func,
};
