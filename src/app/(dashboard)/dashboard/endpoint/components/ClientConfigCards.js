"use client";

import { useState, useEffect } from "react";
import { Card } from "@/shared/components";
import { translate } from "@/i18n/runtime";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

// Copy-ready client configuration cards (Claude Code / Cursor / Codex CLI /
// generic curl) + a minimal interactive console against /v1/chat/completions.
export default function ClientConfigCards({ baseUrl }) {
  const { copied, copy } = useCopyToClipboard();
  const [keys, setKeys] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [fullKey, setFullKey] = useState("");
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("Say hi in one word");
  const [response, setResponse] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.keys) ? d.keys : [];
        setKeys(list);
        if (list[0]) setSelectedId(list[0].id);
      })
      .catch(() => {});
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.models) ? d.models : [];
        setModels(list);
        if (list[0]?.fullModel) setModel(list[0].fullModel);
      })
      .catch(() => {});
  }, []);

  // Reveal the real secret whenever the selection changes.
  useEffect(() => {
    if (!selectedId) return;
    setFullKey("");
    fetch(`/api/keys/${selectedId}/reveal`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFullKey(d?.key || d?.apiKey || ""))
      .catch(() => {});
  }, [selectedId]);

  const selectedName = keys.find((k) => k.id === selectedId)?.name || "";
  const url = baseUrl || "";

  const snippets = [
    {
      id: "claude",
      label: "Claude Code",
      icon: "terminal",
      text: `# Claude Code\nexport ANTHROPIC_BASE_URL="${url}"\nexport ANTHROPIC_AUTH_TOKEN="${fullKey}"`,
    },
    {
      id: "cursor",
      label: "Cursor",
      icon: "smart_toy",
      text: `# Cursor → Settings → Models → OpenAI API Key\nBase URL (override): ${url}\nAPI Key: ${fullKey}`,
    },
    {
      id: "codex",
      label: "Codex CLI",
      icon: "code_blocks",
      text: `# Codex CLI (~/.codex/config or env)\nexport OPENAI_BASE_URL="${url}"\nexport OPENAI_API_KEY="${fullKey}"`,
    },
    {
      id: "curl",
      label: "curl",
      icon: "data_object",
      text: `curl ${url}/chat/completions \\\n  -H "Authorization: Bearer ${fullKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${model}","messages":[{"role":"user","content":"hi"}]}'`,
    },
  ];

  const sendTest = async () => {
    setSending(true);
    setResponse(null);
    try {
      const res = await fetch(`${url}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${fullKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 50,
          stream: false,
        }),
      });
      const json = await res.json().catch(() => null);
      setResponse({ status: res.status, body: json });
    } catch (e) {
      setResponse({ status: 0, body: { error: e.message } });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Key selector */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/50 px-5 py-4">
          <span className="material-symbols-outlined text-lg text-primary">key</span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{translate("Client Configuration")}</h2>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <label className="text-xs text-text-muted">{translate("API Key")}</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-text-main"
          >
            {keys.length === 0 && <option value="">— {translate("No keys created yet")} —</option>}
            {keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          {!keys.length && (
            <p className="text-xs text-text-muted">{translate("Create an API key first (API Keys page).")}</p>
          )}
        </div>
      </Card>

      {/* Snippet cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {snippets.map((s) => (
          <div key={s.id} className="rounded-brand-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-2/40">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-main">
                <span className="material-symbols-outlined text-[18px] text-primary">{s.icon}</span>
                {s.label}
              </span>
              <button
                type="button"
                onClick={() => copy(s.text, s.id)}
                disabled={!fullKey}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-border-subtle hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[14px]">{copied === s.id ? "check" : "content_copy"}</span>
                {copied === s.id ? translate("Copied") : translate("Copy")}
              </button>
            </div>
            <pre dir="ltr" className="p-4 text-[11px] leading-relaxed font-mono text-text-muted overflow-x-auto whitespace-pre-wrap break-all">
              {fullKey ? s.text : translate("Select an API key above to generate this snippet.")}
            </pre>
          </div>
        ))}
      </div>

      {/* Mini console */}
      <div className="rounded-brand-lg border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/50 px-5 py-4">
          <span className="material-symbols-outlined text-lg text-primary">play_circle</span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{translate("Try it live")} — POST {url}/chat/completions</h2>
        </div>
        <div className="p-5 space-y-3">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-text-main"
          >
            {models.length === 0 && <option value="">— no models —</option>}
            {models.map((m) => (
              <option key={m.fullModel} value={m.fullModel}>{m.fullModel}</option>
            ))}
          </select>
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-3 rounded-xl bg-surface-3/50 border border-border-subtle text-sm text-text-main resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            size="sm"
            variant="primary"
            disabled={sending || !fullKey || !model}
            onClick={sendTest}
          >
            {sending ? translate("Sending...") : translate("Send request")}
          </Button>
          {response && (
            <pre dir="ltr" className="max-h-56 overflow-auto p-3 rounded-xl bg-surface-3/50 border border-border-subtle text-xs font-mono text-text-muted whitespace-pre-wrap">
              {JSON.stringify(response, null, 2).slice(0, 4000)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Button({ size = "sm", variant = "primary", disabled, onClick, children }) {
  const base =
    variant === "primary"
      ? "bg-primary text-white hover:bg-primary/90"
      : "border border-border-subtle text-text-muted hover:text-text-main";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-3 ${size === "sm" ? "py-1.5 text-xs" : "py-2 text-sm"} rounded-lg font-medium transition-colors disabled:opacity-40 ${base}`}
    >
      {children}
    </button>
  );
}
