"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { translate } from "@/i18n/runtime";
import { AGENT_TOOLS } from "../components";

function textValue(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function Section({ icon, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-text-main">{translate(title)}</h2>
          {subtitle && <p className="text-[11px] text-text-muted">{translate(subtitle)}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder, secret = false, disabled }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-text-muted">{translate(label)}</span>
      <div className="relative">
        <input
          type={secret && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          dir="ltr"
          className="w-full rounded-xl border border-border bg-bg px-3 py-2 pe-10 text-xs outline-none transition focus:border-primary/50 disabled:opacity-50"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute end-1 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-muted hover:text-text-main"
            tabIndex={-1}
          >
            <span className="material-symbols-outlined text-[16px]">{show ? "visibility_off" : "visibility"}</span>
          </button>
        )}
      </div>
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-text-main">{translate(label)}</span>
        {hint && <span className="block truncate text-[10px] text-text-muted">{translate(hint)}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-[var(--primary)]"
      />
    </label>
  );
}

const EMPTY_MCP_OAUTH = { clientId: "", clientSecret: "", authUrl: "", tokenUrl: "", scopes: "" };

/** Live structured log viewer — ring buffer via /api/dashboard/nova/logs. */
function LogsSection() {
  const [lines, setLines] = useState([]);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [auto, setAuto] = useState(false);

  const load = useCallback(() => {
    const u = new URL("/api/dashboard/nova/logs", window.location.origin);
    if (q) u.searchParams.set("q", q);
    if (level) u.searchParams.set("level", level);
    u.searchParams.set("limit", "300");
    fetch(u, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setLines(Array.isArray(j?.entries) ? j.entries : []))
      .catch(() => {});
  }, [q, level]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [auto, load]);

  const colorFor = (l) => {
    try {
      const o = JSON.parse(l);
      if (o.lvl === "error" || o.lvl === "fatal") return "text-red-500";
      if (o.lvl === "warn") return "text-amber-500";
    } catch {}
    return "text-text-muted";
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="material-symbols-outlined text-[16px] text-primary">receipt_long</span>
        <span className="text-xs font-semibold text-text-main flex-1">{translate("Live logs")}</span>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg border border-border bg-bg px-1.5 py-1 text-[10px]">
          <option value="">{translate("All levels")}</option>
          <option value="warn">warn+</option>
          <option value="error">error+</option>
        </select>
        <button type="button" onClick={() => setAuto((v) => !v)} className={cn("rounded-lg px-2 py-1 text-[10px] font-bold", auto ? "bg-emerald-500/15 text-emerald-600" : "bg-surface-2 text-text-muted")}>
          auto 5s
        </button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={translate("Filter…")} className="mt-2 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[10px] outline-none focus:border-primary/40" dir="ltr" />
      <pre className="custom-scrollbar mt-2 max-h-56 overflow-auto rounded-lg bg-black/90 p-2 text-[9px] leading-relaxed text-emerald-300" dir="ltr">
        {lines.length === 0 ? "(empty)" : lines.map((l) => l).join("\n").slice(-20000)}
      </pre>
    </div>
  );
}
export default function NovaToolsPageClient() {
  const [view, setView] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [savedFlash, setSavedFlash] = useState("");
  const [busy, setBusy] = useState(false);

  // local form state
  const [media, setMedia] = useState(null);
  const [integ, setInteg] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [mcpServers, setMcpServers] = useState([]);
  const [newMcp, setNewMcp] = useState({ name: "", transport: "http", url: "", command: "" });
  const [oauthFor, setOauthFor] = useState(null);
  const [oauthDraft, setOauthDraft] = useState(EMPTY_MCP_OAUTH);
  const [skills, setSkills] = useState([]);
  const [skillUrl, setSkillUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/nova/tools-settings", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(textValue(data.error) || `Failed (${res.status})`);
      setView(data.view || {});
      setMedia(data.view?.media || {});
      setInteg(data.view?.integ || {});
      setPolicy(data.view?.policy || {});
      setMcpServers(data.view?.mcp?.servers || []);
      setLoadError("");
    } catch (e) {
      setLoadError(textValue(e?.message));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/dashboard/nova/skills/export", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSkills(Array.isArray(j?.skills) ? j.skills : []))
      .catch(() => {});
  }, []);

  const flash = (msg) => {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(""), 2500);
  };

  async function save(scope, patch, msg) {
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/nova/tools-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, patch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      flash(msg || translate("Saved ✓"));
    } catch (e) {
      flash(`⚠️ ${textValue(e?.message)}`);
    } finally {
      setBusy(false);
    }
  }

  async function addMcp() {
    if (!newMcp.name.trim()) return;
    await save("mcp", { action: "add", server: newMcp }, translate("MCP server saved"));
    setNewMcp({ name: "", transport: "http", url: "", command: "" });
  }

  async function startOauth(name) {
    try {
      const res = await fetch("/api/dashboard/nova/mcp/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ server: name }),
      });
      const j = await res.json();
      if (j?.authorizeUrl) window.open(j.authorizeUrl, "_blank");
      else flash(`⚠️ ${j?.error || "failed"}`);
    } catch (e) {
      flash(`⚠️ ${textValue(e?.message)}`);
    }
  }

  async function importSkills() {
    if (!skillUrl.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/nova/skills/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: skillUrl.trim() }),
      });
      const j = await res.json();
      flash(j?.ok ? `${j.imported} skills imported ✓` : `⚠️ ${j?.error || "failed"}`);
      if (j?.ok) {
        const ex = await fetch("/api/dashboard/nova/skills/export").then((r) => r.json());
        setSkills(Array.isArray(ex?.skills) ? ex.skills : []);
        setSkillUrl("");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!view && !loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
      </div>
    );
  }

  const inputCls = "w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs outline-none transition focus:border-primary/50";

  return (
    <div className="min-h-screen w-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <a href="/dashboard/nova-bot" className="rounded-xl p-2 text-text-muted hover:bg-surface-2 hover:text-text-main">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </a>
          <div className="size-10 flex items-center justify-center rounded-xl bg-primary/10">
            <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-text-main leading-tight">{translate("Nova Tools & Integrations")}</h1>
            <p className="text-[11px] text-text-muted">{translate("Configure every capability of your AI company")}</p>
          </div>
          {savedFlash && (
            <span className="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {savedFlash}
            </span>
          )}
        </div>

        {loadError && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-400">{loadError}</div>
        )}

        <div className="space-y-4">
          {/* ── Media models ── */}
          <Section icon="movie_filter" title="Media models" subtitle="Which gateway models power vision / image / speech tools">
            {media && (
              <div className="space-y-2.5">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label='Vision model (e.g. gemini/gemini-2.5-flash)' value={media.visionModel ?? ""} onChange={(v) => setMedia({ ...media, visionModel: v })} />
                  <Field label='Image model (e.g. openai/dall-e-3)' value={media.imageModel ?? ""} onChange={(v) => setMedia({ ...media, imageModel: v })} />
                  <Field label='TTS model (e.g. openai/tts-1)' value={media.ttsModel ?? ""} onChange={(v) => setMedia({ ...media, ttsModel: v })} />
                  <Field label='STT model (e.g. openai/whisper-1)' value={media.sttModel ?? ""} onChange={(v) => setMedia({ ...media, sttModel: v })} />
                  <Field label='Voice id (e.g. alloy)' value={media.voice ?? ""} onChange={(v) => setMedia({ ...media, voice: v })} />
                </div>
                <Toggle
                  label="Spoken replies on Telegram"
                  hint="Voice messages get a voice answer back"
                  checked={!!media.voiceReply}
                  onChange={(v) => setMedia({ ...media, voiceReply: v })}
                />
                <Button size="sm" onClick={() => save("media", media)} disabled={busy}>
                  <span className="material-symbols-outlined text-[15px]">save</span>
                  {translate("Save media models")}
                </Button>
              </div>
            )}
          </Section>

          {/* ── Integrations ── */}
          <Section icon="extension" title="Integrations credentials" subtitle="Tokens used by Drive / Home Assistant / X tools">
            {integ && (
              <div className="space-y-2.5">
                <Field
                  label={`Google Drive access token ${integ.hasGdrive ? `(current: ${integ.gdriveTokenMasked})` : "(not set)"}`}
                  value=""
                  onChange={(v) => save("integ", { gdriveAccessToken: v })}
                  placeholder={integ.hasGdrive ? "•••• (leave empty to keep)" : "ya29...."}
                  secret
                  disabled={busy}
                />
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label="Home Assistant URL" value={integ.haUrl ?? ""} onChange={(v) => setInteg({ ...integ, haUrl: v })} placeholder="http://homeassistant.local:8123" />
                  <Field
                    label={`HA long-lived token ${integ.hasHa ? `(current: ${integ.haTokenMasked})` : "(not set)"}`}
                    value=""
                    onChange={(v) => save("integ", { haToken: v })}
                    placeholder={integ.hasHa ? "•••• (empty = keep)" : "ey..."}
                    secret
                    disabled={busy}
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => save("integ", { haUrl: integ.haUrl })} disabled={busy}>
                  <span className="material-symbols-outlined text-[15px]">save</span>
                  {translate("Save HA URL")}
                </Button>
                <Field
                  label={`xAI API key (for X search) ${integ.hasXai ? `(current: ${integ.xaiKeyMasked})` : "(not set)"}`}
                  value=""
                  onChange={(v) => save("integ", { xaiApiKey: v })}
                  placeholder={integ.hasXai ? "•••• (empty = keep)" : "xai-..."}
                  secret
                  disabled={busy}
                />
              </div>
            )}
          </Section>

          {/* ── MCP servers ── */}
          <Section icon="hub" title="MCP servers" subtitle="External tool providers (stdio or HTTP). OAuth-ready.">
            <div className="space-y-2">
              {(mcpServers || []).map((s) => (
                <div key={s.name} className="rounded-xl border border-border bg-bg px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-text-muted">{s.transport === "http" ? "cloud" : "terminal"}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-main">{s.name}</span>
                    {s.connected ? (
                      <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">OAuth ✓</span>
                    ) : s.hasOauth ? (
                      <button type="button" onClick={() => startOauth(s.name)} className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20">
                        Connect OAuth
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => save("mcp", { action: "remove", name: s.name })}
                      className="shrink-0 p-1 text-text-muted hover:text-red-500"
                      title={translate("Delete")}
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-text-muted" dir="ltr">{s.url || s.command || "—"}</p>
                  <details className="mt-1.5">
                    <summary className="cursor-pointer select-none text-[10px] font-medium text-primary">{translate("OAuth config")}</summary>
                    <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2" dir="ltr">
                      {["clientId", "clientSecret", "authUrl", "tokenUrl", "scopes"].map((k) => (
                        <input
                          key={k}
                          type={k === "clientSecret" ? "password" : "text"}
                          placeholder={k}
                          value={oauthFor === s.name ? oauthDraft[k] : ""}
                          onFocus={() => { if (oauthFor !== s.name) { setOauthFor(s.name); setOauthDraft(EMPTY_MCP_OAUTH); } }}
                          onChange={(e) => setOauthDraft({ ...oauthDraft, [k]: e.target.value })}
                          className={inputCls}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => save("mcp", { action: "save_oauth", name: s.name, oauth: oauthDraft }, "OAuth config saved")}
                        className="rounded-xl bg-primary/10 px-2 py-2 text-[10px] font-bold text-primary hover:bg-primary/20 sm:col-span-2"
                      >
                        Save OAuth config for {s.name}
                      </button>
                    </div>
                  </details>
                </div>
              ))}

              {/* add form */}
              <div className="rounded-xl border border-dashed border-border bg-bg/60 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input placeholder={translate("Name")} value={newMcp.name} onChange={(e) => setNewMcp({ ...newMcp, name: e.target.value })} className={inputCls} dir="ltr" />
                  <select value={newMcp.transport} onChange={(e) => setNewMcp({ ...newMcp, transport: e.target.value })} className={inputCls}>
                    <option value="http">HTTP</option>
                    <option value="stdio">stdio (local process)</option>
                  </select>
                  {newMcp.transport === "http" ? (
                    <input placeholder="https://mcp.example.com/rpc" value={newMcp.url} onChange={(e) => setNewMcp({ ...newMcp, url: e.target.value })} className={`${inputCls} sm:col-span-2`} dir="ltr" />
                  ) : (
                    <input placeholder="/usr/bin/node server.js --flag" value={newMcp.command} onChange={(e) => setNewMcp({ ...newMcp, command: e.target.value })} className={`${inputCls} sm:col-span-2`} dir="ltr" />
                  )}
                </div>
                <Button size="sm" variant="outline" icon="add" className="mt-2" onClick={addMcp} disabled={busy || !newMcp.name.trim()}>
                  {translate("Add server")}
                </Button>
              </div>
            </div>
          </Section>

          {/* ── Security policy ── */}
          <Section icon="shield" title="Security policy" subtitle="Approval flow hardening">
            {policy && (
              <div className="space-y-2.5">
                <Toggle
                  label="Auto-approve read-only commands"
                  hint="ls/cat/status/git-log run without admin ping (still audited)"
                  checked={policy.autoApproveReadOnly !== false}
                  onChange={(v) => save("policy", { autoApproveReadOnly: v })}
                />
                <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2.5">
                  <span className="text-xs font-medium text-text-main">{translate("Max approvals per hour")}</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={policy.maxApprovalsPerHour ?? 20}
                    onChange={(e) => setPolicy({ ...policy, maxApprovalsPerHour: Number(e.target.value) })}
                    onBlur={() => save("policy", { maxApprovalsPerHour: policy.maxApprovalsPerHour })}
                    className="w-20 rounded-lg border border-border bg-transparent px-2 py-1 text-center text-xs outline-none focus:border-primary/50"
                    dir="ltr"
                  />
                </label>
              </div>
            )}
          </Section>

          {/* ── Skills hub ── */}
          <Section icon="school" title="Skills library" subtitle={`${skills.length} skills installed — import from any JSON URL`}>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  placeholder="https://example.com/my-skills.json"
                  value={skillUrl}
                  onChange={(e) => setSkillUrl(e.target.value)}
                  className={inputCls}
                  dir="ltr"
                />
                <Button size="sm" variant="outline" onClick={importSkills} disabled={busy || !skillUrl.trim()}>
                  {translate("Import")}
                </Button>
              </div>
              <a href="/api/dashboard/nova/skills/export" download="nova-skills.json" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline">
                <span className="material-symbols-outlined text-[14px]">download</span>
                {translate("Export library as JSON")}
              </a>
              {!!skills.length && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-bg/60 p-2 custom-scrollbar">
                  {skills.slice(0, 60).map((sk, i) => (
                    <div key={`${sk.skill_name}-${i}`} className="flex items-center gap-2 text-[10px]">
                      <span className="truncate font-medium text-text-main" dir="auto">{sk.skill_name}</span>
                      <span className="ms-auto shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-text-muted">{sk.usage_count ?? 0}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── Live logs ── */}
          <Section icon="receipt_long" title="System logs" subtitle="Structured errors & events — newest last">
            <LogsSection />
          </Section>

          {/* ── Per-agent grants hint ── */}
          <Section icon="assignment_ind" title="Grant tools to agents" subtitle="Open an agent in the team panel and tick any of these">
            <div className="flex flex-wrap gap-1.5">
              {AGENT_TOOLS.map(([key, , label]) => (
                <span key={key} className="rounded-full border border-border bg-bg px-2.5 py-1 text-[10px] text-text-main">{translate(label)}</span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-text-muted">
              {translate("Channels (Telegram / Discord / WhatsApp) are configured on the")}{" "}
              <a href="/dashboard/apps" className="font-medium text-primary hover:underline">{translate("Apps page")}</a>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
