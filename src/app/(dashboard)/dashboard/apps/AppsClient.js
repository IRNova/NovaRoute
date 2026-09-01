"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import Modal from "@/shared/components/Modal";
import Toggle from "@/shared/components/Toggle";
import { translate } from "@/i18n/runtime";
import { cn } from "@/shared/utils/cn";
import { UserbotModal, GitHubModal, CloudflareModal, InstagramModal } from "@/app/(dashboard)/dashboard/nova-bot/components";

/* Catalog — messaging platforms from the Hermes Gateway model.
   telegram is fully wired to Nova Bot. The rest store config and
   light up when their runtime adapters ship. */

const CHANNEL_CATALOG = [
  {
    id: "telegram",
    name: "Telegram",
    icon: "send",
    color: "#229ED9",
    wired: "nova",
    desc: "Full bridge — CEO answers right in your chat.",
    fields: [],
  },
  {
    id: "auto-responder",
    name: "Auto-responder",
    icon: "support_agent",
    color: "#8B5CF6",
    wired: "userbot",
    locked: true,
    alwaysOn: true,
    desc: "Personal-account auto-responder with knowledge base & memory.",
    fields: [],
  },
  {
    id: "discord",
    name: "Discord",
    icon: "forum",
    color: "#5865F2",
    desc: "Community servers & DMs.",
    fields: [
      { id: "botToken", label: "Bot Token", required: true, secret: true },
      { id: "applicationId", label: "Application ID" },
      { id: "guildId", label: "Server (Guild) ID" },
    ],
  },
  {
    id: "whatsapp-cloud",
    name: "WhatsApp",
    icon: "chat",
    color: "#25D366",
    desc: "WhatsApp Cloud API business chats.",
    fields: [
      { id: "phoneNumberId", label: "Phone Number ID", required: true },
      { id: "accessToken", label: "Access Token", required: true, secret: true },
      { id: "verifyToken", label: "Webhook Verify Token", secret: true },
      { id: "wabaId", label: "WABA ID" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "workspaces",
    color: "#E01E5A",
    desc: "Workspace channels & threads.",
    fields: [
      { id: "botToken", label: "Bot Token (xoxb)", required: true, secret: true },
      { id: "signingSecret", label: "Signing Secret", required: true, secret: true },
      { id: "appToken", label: "App Token (xapp)", secret: true },
    ],
  },
  {
    id: "signal",
    name: "Signal",
    icon: "lock",
    color: "#3A76F0",
    desc: "Private & encrypted messaging.",
    fields: [
      { id: "phoneNumber", label: "Phone Number (+…)", required: true },
      { id: "rpcUrl", label: "signal-cli RPC URL", placeholder: "http://127.0.0.1:8080" },
    ],
  },
  {
    id: "bluebubbles",
    name: "iMessage",
    icon: "smartphone",
    color: "#6C8DFF",
    desc: "iMessage via BlueBubbles server.",
    fields: [
      { id: "serverUrl", label: "Server URL", required: true },
      { id: "password", label: "Password", required: true, secret: true },
    ],
  },
  {
    id: "weixin",
    name: "WeCom",
    icon: "groups",
    color: "#07C160",
    desc: "WeChat Work enterprise messaging.",
    fields: [
      { id: "corpId", label: "Corp ID", required: true },
      { id: "corpSecret", label: "Corp Secret", required: true, secret: true },
      { id: "agentId", label: "Agent ID", required: true },
    ],
  },
  {
    id: "teams",
    name: "MS Teams",
    icon: "groups_3",
    color: "#6264A7",
    desc: "Microsoft Teams via Graph webhook.",
    fields: [
      { id: "appId", label: "App ID", required: true },
      { id: "appPassword", label: "App Password", required: true, secret: true },
    ],
  },
  {
    id: "cli",
    name: "Terminal",
    icon: "terminal",
    color: "#10B981",
    desc: "Built-in local TUI. Always on.",
    alwaysOn: true,
    fields: [],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "photo_camera",
    color: "#E4405F",
    wired: "instagram",
    desc: "Auto-reply to Instagram DMs with AI.",
    fields: [],
  },
  {
    id: "github",
    name: "GitHub",
    icon: "code",
    color: "#f0f0f0",
    wired: "github",
    desc: "Create repos, commit files, open issues and pull requests.",
    // What the agent can actually do once this is connected. The page used to
    // promise "push code" while only read tools existed.
    grants: [
      "Read repos, branches, issues and commits",
      "Create a repository",
      "Create a branch",
      "Commit a file",
      "Open an issue",
      "Open a pull request",
    ],
    fields: [],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    icon: "cloud",
    color: "#F38020",
    wired: "cloudflare",
    desc: "Read zones and Workers, manage DNS records, purge cache.",
    grants: [
      "List zones, DNS records and Workers",
      "Create a DNS record",
      "Update a DNS record",
      "Delete a DNS record",
      "Purge the cache",
    ],
    fields: [],
  },
];

function missingRequired(ch, fields = {}) {
  return (ch.fields || []).filter((f) => f.required && !String(fields[f.id] || "").trim()).map((f) => f.label);
}

/* ------------------------------ Page ------------------------------ */

export default function AppsClient() {
  const [saved, setSaved] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // channel object being configured
  const [toggling, setToggling] = useState(null);
  const [userbotOpen, setUserbotOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [cloudflareOpen, setCloudflareOpen] = useState(false);
  const [instagramOpen, setInstagramOpen] = useState(false);
  const [novaAgents, setNovaAgents] = useState([]);
  const [tgStatus, setTgStatus] = useState({
    hasToken: false,
    enabled: false,
    pollerRunning: false,
    webhookActive: false,
  });
  const [ghStatus, setGhStatus] = useState({
    connected: false,
    user: null,
  });
  const [cfStatus, setCfStatus] = useState({
    connected: false,
    user: null,
  });
  const [igStatus, setIgStatus] = useState({
    connected: false,
    enabled: false,
  });

  const loadSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/channels", { cache: "no-store" });
      const data = await res.json();
      setSaved(data.channels || {});
    } catch { /* ignore */ }
  }, []);

  const loadTgStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/nova/telegram/config", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setTgStatus({
        hasToken: Boolean(data.config?.hasToken),
        enabled: Boolean(data.config?.enabled),
        pollerRunning: Boolean(data.pollerRunning),
        webhookActive: Boolean(data.webhook?.url),
      });
    } catch { /* ignore */ }
  }, []);

  const loadGhStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/nova/github/auth/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setGhStatus({
        connected: Boolean(data.connected),
        user: data.user || null,
      });
    } catch { /* ignore */ }
  }, []);

  const loadCfStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/nova/cloudflare/auth/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setCfStatus({
        connected: Boolean(data.connected),
        user: data.user || null,
      });
    } catch { /* ignore */ }
  }, []);

  const loadIgStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/nova/instagram/config", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setIgStatus({
        connected: Boolean(data.config?.hasToken),
        enabled: Boolean(data.config?.enabled),
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadSaved();
    loadTgStatus();
    loadGhStatus();
    loadCfStatus();
    loadIgStatus();
    fetch("/api/dashboard/nova/agents", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNovaAgents(d.agents || []))
      .catch(() => {});
  }, [loadSaved, loadTgStatus, loadGhStatus, loadCfStatus, loadIgStatus]);

  const isEnabled = (ch) => {
    if (ch.alwaysOn) return true;
    if (ch.id === "telegram") {
      // Telegram truth comes from its own bridge status.
      return tgStatus.enabled && (tgStatus.pollerRunning || tgStatus.webhookActive) ? true : tgStatus.enabled;
    }
    if (ch.id === "github") return ghStatus.connected;
    if (ch.id === "cloudflare") return cfStatus.connected;
    if (ch.id === "instagram") return igStatus.enabled;
    return Boolean(saved[ch.id]?.enabled);
  };

  const isConfigured = (ch) => {
    if (ch.id === "telegram") return tgStatus.hasToken;
    if (ch.id === "github") return ghStatus.connected;
    if (ch.id === "cloudflare") return cfStatus.connected;
    if (ch.id === "instagram") return igStatus.connected;
    if (ch.alwaysOn) return true;
    const st = saved[ch.id];
    if (!st) return false;
    return missingRequired(ch, st.fields || {}).length === 0;
  };

  const isRunning = (ch) => {
    if (ch.id === "telegram") return tgStatus.enabled && (tgStatus.pollerRunning || tgStatus.webhookActive);
    if (ch.id === "github") return ghStatus.connected;
    if (ch.id === "cloudflare") return cfStatus.connected;
    if (ch.id === "instagram") return igStatus.connected && igStatus.enabled;
    if (ch.alwaysOn) return true;
    return Boolean(saved[ch.id]?.enabled) && isConfigured(ch);
  };

  const handleToggle = async (ch) => {
    const id = ch.id;
    if (ch.alwaysOn) return;
    setToggling(id);
    try {
      const enabled = !isEnabled(ch);
      if (id === "telegram") {
        // Telegram toggle routes through its real bridge config.
        await fetch("/api/dashboard/nova/telegram/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
        await loadTgStatus();
      } else if (id === "github") {
        if (enabled) {
          // Open GitHub connection modal for OAuth
          setGithubOpen(true);
        } else {
          // Disconnect GitHub
          await fetch("/api/dashboard/nova/github/auth/status", { method: "DELETE" }).catch(() => {});
          await loadGhStatus();
        }
      } else if (id === "cloudflare") {
        if (enabled) {
          // Open Cloudflare connection modal for OAuth
          setCloudflareOpen(true);
        } else {
          // Disconnect Cloudflare
          await fetch("/api/dashboard/nova/cloudflare/auth/status", { method: "DELETE" }).catch(() => {});
          await loadCfStatus();
        }
      } else if (id === "instagram") {
        if (enabled) {
          // Open Instagram config modal
          setInstagramOpen(true);
        } else {
          // Disable Instagram bridge
          await fetch("/api/dashboard/nova/instagram/config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: false }),
          }).catch(() => {});
          await loadIgStatus();
        }
      } else {
        const prev = saved[id]?.fields || {};
        const res = await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, enabled, fields: prev }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed (${res.status})`);
        await loadSaved();
      }
    } catch (err) {
      console.error("channel toggle failed:", err);
    } finally {
      setToggling(null);
    }
  };

  const handleSaveFields = async (ch, fields) => {
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ch.id, enabled: true, fields }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
    await loadSaved();
    if (ch.id === "telegram") await loadTgStatus();
  };

  const channels = CHANNEL_CATALOG.map((ch) => ({
    ch,
    enabled: isEnabled(ch),
    configured: isConfigured(ch),
    running: isRunning(ch),
    savedFields: saved[ch.id]?.fields || {},
  }));

  const connectedCount = channels.filter((c) => c.running).length;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-0">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-elevated p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.25)]">
          <div className="relative flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-elevated text-primary shadow-lg shadow-primary/10">
              <span className="material-symbols-outlined text-[28px]">apps</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-text-main">{translate("Apps")}</h1>
              <p className="text-sm text-text-muted mt-0.5">
                {translate("Messaging apps hub — every channel your agents can talk through.")}
              </p>
            </div>
            <Badge tone={connectedCount > 0 ? "success" : "default"} dot={connectedCount > 0}>
              {connectedCount} {translate("running")}
            </Badge>
          </div>
        </div>

        {/* Channel grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {channels.map(({ ch, enabled, running }) => {
            const configured = isConfigured(ch);
            return (
              <ChannelCard
                key={ch.id}
                ch={ch}
                enabled={enabled}
                running={running}
                configured={configured}
                toggling={toggling === ch.id}
                onToggle={() => handleToggle(ch)}
                onEdit={() => (ch.wired === "userbot" ? setUserbotOpen(true) : ch.wired === "github" ? setGithubOpen(true) : ch.wired === "cloudflare" ? setCloudflareOpen(true) : ch.wired === "instagram" ? setInstagramOpen(true) : setEditing(ch))}
              />
            );
          })}
        </div>

        {editing && (
          <ChannelEditModal
            channel={editing}
            savedFields={saved[editing.id]?.fields || {}}
            tgStatus={tgStatus}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              await loadSaved();
              if (editing.id === "telegram") await loadTgStatus();
            }}
          />
        )}

        {/* Auto-responder full manager (security-key gated inside) */}
        <UserbotModal open={userbotOpen} onClose={() => setUserbotOpen(false)} agents={[]} />

        {/* GitHub connection manager */}
        <GitHubModal open={githubOpen} onClose={() => { setGithubOpen(false); loadGhStatus(); }} />

        {/* Cloudflare connection manager */}
        <CloudflareModal open={cloudflareOpen} onClose={() => { setCloudflareOpen(false); loadCfStatus(); }} />

        {/* Instagram DM bridge manager */}
        <InstagramModal open={instagramOpen} onClose={() => { setInstagramOpen(false); loadIgStatus(); }} />
      </div>
    </div>
  );
}

function ChannelCard({ ch, enabled, running, configured, toggling, onToggle, onEdit }) {
  const isLocked = !!ch.locked;
  const dotCls = running || isLocked && enabled
    ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_currentColor]"
    : enabled
      ? "bg-amber-400"
      : "bg-zinc-500";
  const statusText = running || isLocked && enabled
    ? translate("Running")
    : enabled
      ? configured
        ? translate("Enabled — adapter pending")
        : translate("Needs configuration")
      : translate("Off");

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-sm transition-all hover:shadow-md",
        running ? "border-emerald-500/30" : "border-border",
        ch.alwaysOn && "border-dashed"
      )}
    >
      {/* header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: ch.color + "1f", color: ch.color }}
          >
            <span className="material-symbols-outlined text-[22px]">{ch.icon}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text-main">{ch.name}</p>
          </div>
        </div>
        {isLocked ? (
          <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0" title={translate("Protected — configure to manage")}>lock</span>
        ) : (
          <Toggle checked={enabled} onChange={() => onToggle(ch)} disabled={toggling || ch.alwaysOn} size="sm" />
        )}
      </div>

      {/* status line */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className={cn("size-2 rounded-full", dotCls)} />
        <span className={cn(running ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-text-muted")}>
          {statusText}
        </span>
        {!configured && !running && (
          <span className="text-red-500/80">· {translate("missing required fields")}</span>
        )}
      </div>

      <p className="line-clamp-2 min-h-[32px] text-xs leading-5 text-text-muted">{translate(ch.desc)}</p>

      {/* What connecting this actually grants the agent. Stated per app so the
          card cannot drift back into promising capability that is not wired. */}
      {ch.grants?.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {ch.grants.map((g) => (
            <li key={g} className="flex items-start gap-1.5 text-[11px] leading-4 text-text-muted">
              <span className="material-symbols-outlined mt-px text-[13px] text-emerald-500">check</span>
              <span>{translate(g)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* footer */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" icon="tune" onClick={onEdit}>
          {translate("Configure")}
        </Button>
      </div>
    </div>
  );
}

/* --------------------- Edit modal (per channel) --------------------- */

function ChannelEditModal({ channel, savedFields, tgStatus, onClose, onSaved }) {
  const [fields, setFields] = useState(savedFields);
  const [tgForm, setTgForm] = useState(null); // telegram full form when editing telegram
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isTelegram = channel.id === "telegram";

  // For telegram, preload its real config into the form.
  useEffect(() => {
    if (!isTelegram) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/nova/telegram/config", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.config) {
          setTgForm({
            botToken: "",
            adminChatId: data.config.adminChatId || "",
            publicBaseUrl: data.config.publicBaseUrl || "",
            enabled: Boolean(data.config.enabled),
            mode: data.config.mode === "polling" ? "polling" : "webhook",
          });
          setFields({
            botTokenMasked: data.config.botTokenMasked || "",
            botUsername: data.botUsername || null,
          });
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [isTelegram]);

  const saveGeneric = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: channel.id, enabled: true, fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setNotice(translate("Configuration stored"));
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveTelegram = async () => {
    if (!tgForm) return;
    if (!tgForm.adminChatId.trim() || (!tgStatus.hasToken && !tgForm.botToken.trim())) {
      setError(translate("Bot token and admin ID are required"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        adminChatId: tgForm.adminChatId.trim(),
        publicBaseUrl: tgForm.publicBaseUrl.trim(),
        enabled: tgForm.enabled,
        mode: tgForm.mode,
      };
      if (tgForm.botToken.trim()) payload.botToken = tgForm.botToken.trim();
      const res = await fetch("/api/dashboard/nova/telegram/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setNotice(translate("Settings saved"));
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${channel.name} — ${translate("Configuration")}`} size="lg">
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-surface-2/50 px-3 py-2 text-xs leading-5 text-text-muted" dir="auto">
          {translate(channel.desc)}
        </p>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400" dir="auto">{error}</p>
        )}
        {notice && (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400" dir="auto">{notice}</p>
        )}

        {isTelegram ? (
          <>
            {!tgForm ? (
              <p className="py-6 text-center text-sm text-text-muted">{translate("Loading…")}</p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-text-main">{translate("Bot token")}</span>
                  <input type="password" value={tgForm.botToken}
                    onChange={(e) => setTgForm((p) => ({ ...p, botToken: e.target.value }))}
                    placeholder={tgStatus.hasToken ? "••••••••" : "123456:ABC-DEF..."}
                    dir="ltr" autoComplete="off"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40" />
                  <span className="mt-1 block text-[11px] text-text-muted">{translate("Get it from @BotFather")}</span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-text-main">{translate("Admin numeric ID")}</span>
                  <input type="text" value={tgForm.adminChatId}
                    onChange={(e) => setTgForm((p) => ({ ...p, adminChatId: e.target.value.replace(/[^\d-]/g, "") }))}
                    placeholder="123456789" dir="ltr" inputMode="numeric"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40" />
                  <span className="mt-1 block text-[11px] text-text-muted">
                    {translate("Your own numeric ID from @userinfobot — only you can talk to the bot.")}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-text-main">{translate("Connection mode")}</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ v: "polling", l: translate("Long polling"), i: "sync" }, { v: "webhook", l: translate("Webhook"), i: "link" }].map((o) => (
                      <button key={o.v} type="button" onClick={() => setTgForm((p) => ({ ...p, mode: o.v }))}
                        className={cn("flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-[11px] font-medium transition",
                          tgForm.mode === o.v ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-surface-2/30 text-text-muted hover:bg-surface-2")}>
                        <span className="material-symbols-outlined text-[18px]">{o.i}</span>{o.l}
                      </button>
                    ))}
                  </div>
                </label>
                <label className={cn("block", tgForm.mode === "polling" && "opacity-50")}>
                  <span className="mb-1 block text-xs font-medium text-text-main">{translate("Public base URL (optional)")}</span>
                  <input type="url" value={tgForm.publicBaseUrl}
                    onChange={(e) => setTgForm((p) => ({ ...p, publicBaseUrl: e.target.value }))}
                    placeholder="https://panel.example.com" dir="ltr"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm text-text-main outline-none focus:border-primary/40" />
                </label>
              </>
            )}
          </>
        ) : (
          (channel.fields || []).map((f) => (
            <label key={f.id} className="block">
              <span className="mb-1 block text-xs font-medium text-text-main">
                {f.label}{f.required && <span className="text-red-500"> *</span>}
              </span>
              <input
                type={f.secret ? "password" : "text"}
                value={fields[f.id] || ""}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.id]: e.target.value }))}
                placeholder={f.placeholder || ""}
                dir="ltr"
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm font-mono text-text-main outline-none placeholder:text-text-muted focus:border-primary/40"
              />
            </label>
          ))
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>{translate("Close")}</Button>
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            disabled={!isTelegram && missingRequired(channel, fields).length > 0}
            onClick={() => (isTelegram ? saveTelegram() : saveGeneric())}
          >
            {busy ? translate("Saving…") : translate("Save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

