"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, Button, Input, Modal, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  TUNNEL_BENEFITS,
  TUNNEL_PING_INTERVAL_MS,
  TUNNEL_PING_MAX_MS,
  STATUS_POLL_FAST_MS,
  REACHABLE_MISS_THRESHOLD,
  CLIENT_PING_FAST_MS,
} from "./endpointConstants";
import { clientPingUrl, clientPingAny } from "./endpointPing";
import EndpointRow from "./components/EndpointRow";

import StatusAlert from "./components/StatusAlert";
import Tooltip from "./components/Tooltip";
import SecurityWarning from "./components/SecurityWarning";
import ModelsExplorer from "./components/ModelsExplorer";
import MCPSection from "./components/MCPSection";
import A2ASection from "./components/A2ASection";
import { translate } from "@/i18n/runtime";
export default function APIPageClient() {
  const [activeTab, setActiveTab] = useState("api");
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [requireLogin, setRequireLogin] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);
 const [tunnelDashboardAccess, setTunnelDashboardAccess] = useState(false);

  // Server LAN addresses (from /api/server-info) for the IP endpoint rows
  const [lanIps, setLanIps] = useState([]);
  const [serverPort, setServerPort] = useState(20128);
  const [publicIp, setPublicIp] = useState("");
  // Browser origin info — distinguishes local vs IP vs domain access
  const [originInfo, setOriginInfo] = useState({ hostname: "", origin: "" });

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOriginInfo({ hostname: window.location.hostname, origin: window.location.origin });
    }
  }, []);

 // Cloudflare Tunnel state
  const [tunnelChecking, setTunnelChecking] = useState(true);
  const [tunnelEnabled, setTunnelEnabled] = useState(false);
  const [tunnelReachable, setTunnelReachable] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [tunnelPublicUrl, setTunnelPublicUrl] = useState("");
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelProgress, setTunnelProgress] = useState("");
  const [tunnelStatus, setTunnelStatus] = useState(null);
  const [showEnableTunnelModal, setShowEnableTunnelModal] = useState(false);
  const [showDisableTunnelModal, setShowDisableTunnelModal] = useState(false);

  // Tailscale state
  const [tsEnabled, setTsEnabled] = useState(false);
  const [tsReachable, setTsReachable] = useState(false);
  const [tsUrl, setTsUrl] = useState("");
  const [tsLoading, setTsLoading] = useState(false);
  const [tsProgress, setTsProgress] = useState("");
  const [tsStatus, setTsStatus] = useState(null);
  const [tsAuthUrl, setTsAuthUrl] = useState("");
  const [tsAuthLabel, setTsAuthLabel] = useState("");
  const [tsInstalled, setTsInstalled] = useState(null); // null=checking, true/false
  const [tsInstalling, setTsInstalling] = useState(false);
  const [tsInstallLog, setTsInstallLog] = useState([]);
  const [tsSudoPassword, setTsSudoPassword] = useState("");
  const [tsConnecting, setTsConnecting] = useState(false);
  const [showTsModal, setShowTsModal] = useState(false);
  const [showDisableTsModal, setShowDisableTsModal] = useState(false);
  const tsLogRef = useRef(null);

  // Debounce reachable=false: server may briefly return false during background refresh.
  // Only flip UI to "reconnecting" after N consecutive misses to avoid spinner flicker.
  const tunnelMissRef = useRef(0);
  const tsMissRef = useRef(0);
  // Browser-side reachable cache (independent of backend DNS quirks)
  const tunnelClientReachableRef = useRef(false);
  const tsClientReachableRef = useRef(false);
  // Track whether reachable=true was ever observed in this session.
  // Distinguishes "Checking..." (initial cold cache) from "Reconnecting..." (lost connection).
  const tunnelEverReachableRef = useRef(false);
  const tsEverReachableRef = useRef(false);
  const [tunnelEverReachable, setTunnelEverReachable] = useState(false);
  const [tsEverReachable, setTsEverReachable] = useState(false);

  // Client-side local/remote detection (UI hint only, not a security gate)
  const [isRemoteHost, setIsRemoteHost] = useState(() =>
    typeof window !== "undefined" ? !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) : false
  );

  const { copied, copy } = useCopyToClipboard();

  // Security gate: block remote exposure while dashboard uses default password or login is off.
  const isLoginUnsafe = !requireLogin || !hasPassword;
  const unsafeReason = !requireLogin
    ? "Enable \"Require login\" and set a custom password before activating the tunnel."
    : "Change the default dashboard password before activating the tunnel.";

  // Load LAN IPs for the IP endpoint rows (best-effort, only on the local server)
  useEffect(() => {
    fetch("/api/server-info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setLanIps(d.ips || []);
          if (d.port) setServerPort(d.port);
          if (d.publicIp) setPublicIp(d.publicIp);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll install log
  useEffect(() => {
    if (tsLogRef.current) tsLogRef.current.scrollTop = tsLogRef.current.scrollHeight;
  }, [tsInstallLog]);

  // Client-side reachable only (server no longer probes; watchdog handles backend health).
  // Miss-debounce: only flip to false after N consecutive misses.
  const updateReachable = useCallback((_unused, clientRef, missRef, setter, everRef, everSetter) => {
    const reachable = clientRef.current;
    if (reachable) {
      missRef.current = 0;
      setter(true);
      if (!everRef.current) {
        everRef.current = true;
        everSetter(true);
      }
    } else {
      missRef.current += 1;
      if (missRef.current >= REACHABLE_MISS_THRESHOLD) setter(false);
    }
  }, []);

  // Trust user intent (settingsEnabled): UI stays "enabled" while watchdog restarts process
  const syncTunnelStatus = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/tunnel/status", { cache: "no-store" });
      if (!statusRes.ok) return;
      const data = await statusRes.json();
      const tEnabled = data.tunnel?.settingsEnabled ?? data.tunnel?.enabled ?? false;
      const tUrl = data.tunnel?.tunnelUrl || "";
      setTunnelUrl(tUrl);
      setTunnelPublicUrl(data.tunnel?.publicUrl || "");
      setTunnelEnabled(tEnabled);
      updateReachable(null, tunnelClientReachableRef, tunnelMissRef, setTunnelReachable, tunnelEverReachableRef, setTunnelEverReachable);

      const tsEn = data.tailscale?.settingsEnabled ?? data.tailscale?.enabled ?? false;
      const tsUrlVal = data.tailscale?.tunnelUrl || "";
      setTsUrl(tsUrlVal);
      setTsEnabled(tsEn);
      updateReachable(null, tsClientReachableRef, tsMissRef, setTsReachable, tsEverReachableRef, setTsEverReachable);
    } catch { /* ignore poll errors */ }
  }, [setTunnelUrl, setTunnelPublicUrl, setTunnelEnabled, updateReachable, setTsUrl, setTsEnabled]);

  // Status poll: only while degraded (not yet reachable). Stop once healthy to avoid spam.
  // Visibility re-check: refresh once when tab becomes visible.
  useEffect(() => {
    const anyEnabled = tunnelEnabled || tsEnabled;
    if (!anyEnabled) return;
    const tunnelHealthy = !tunnelEnabled || tunnelReachable;
    const tsHealthy = !tsEnabled || tsReachable;
    const allHealthy = tunnelHealthy && tsHealthy;
    const onVisible = () => { if (!document.hidden) syncTunnelStatus(); };
    document.addEventListener("visibilitychange", onVisible);
    if (allHealthy) return () => document.removeEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => { if (!document.hidden) syncTunnelStatus(); }, STATUS_POLL_FAST_MS);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tunnelEnabled, tsEnabled, tunnelReachable, tsReachable, syncTunnelStatus]);

  // Browser-side periodic ping: probes tunnel/tailscale URLs directly so UI stays
  // "reachable" even when backend DNS (1.1.1.1) hiccups on *.ts.net or *.trycloudflare.com.
  // Adaptive: slow when healthy, fast when degraded; pause when tab hidden.
  useEffect(() => {
    const probeBoth = async () => {
      if (document.hidden) return;
      if (tunnelEnabled && (tunnelUrl || tunnelPublicUrl)) {
        const ok = await clientPingAny(tunnelPublicUrl, tunnelUrl);
        tunnelClientReachableRef.current = ok;
        if (ok) { tunnelMissRef.current = 0; setTunnelReachable(true); if (!tunnelEverReachableRef.current) { tunnelEverReachableRef.current = true; setTunnelEverReachable(true); } }
        else { tunnelMissRef.current += 1; if (tunnelMissRef.current >= REACHABLE_MISS_THRESHOLD) setTunnelReachable(false); }
      } else {
        tunnelClientReachableRef.current = false;
      }
      if (tsEnabled && tsUrl) {
        const ok = await clientPingUrl(tsUrl);
        tsClientReachableRef.current = ok;
        if (ok) { tsMissRef.current = 0; setTsReachable(true); if (!tsEverReachableRef.current) { tsEverReachableRef.current = true; setTsEverReachable(true); } }
        else { tsMissRef.current += 1; if (tsMissRef.current >= REACHABLE_MISS_THRESHOLD) setTsReachable(false); }
      } else {
        tsClientReachableRef.current = false;
      }
    };
    const anyEnabled = (tunnelEnabled && (tunnelUrl || tunnelPublicUrl)) || (tsEnabled && tsUrl);
    if (!anyEnabled) return;
    probeBoth();
    const tunnelHealthy = !tunnelEnabled || tunnelReachable;
    const tsHealthy = !tsEnabled || tsReachable;
    if (tunnelHealthy && tsHealthy) return;
    const id = setInterval(probeBoth, CLIENT_PING_FAST_MS);
    return () => clearInterval(id);
  }, [tunnelEnabled, tunnelUrl, tunnelPublicUrl, tsEnabled, tsUrl, tunnelReachable, tsReachable]);

  const loadSettings = async () => {
    setTunnelChecking(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/tunnel/status", { cache: "no-store" })
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setRequireApiKey(data.requireApiKey || false);
        setRequireLogin(data.requireLogin !== false);
        setHasPassword(data.hasPassword || false);
        setTunnelDashboardAccess(data.tunnelDashboardAccess || false);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        const tEnabled = data.tunnel?.settingsEnabled ?? data.tunnel?.enabled ?? false;
        const tUrl = data.tunnel?.tunnelUrl || "";
        setTunnelUrl(tUrl);
        setTunnelPublicUrl(data.tunnel?.publicUrl || "");
        setTunnelEnabled(tEnabled);
        updateReachable(null, tunnelClientReachableRef, tunnelMissRef, setTunnelReachable, tunnelEverReachableRef, setTunnelEverReachable);

        const tsEn = data.tailscale?.settingsEnabled ?? data.tailscale?.enabled ?? false;
        const tsUrlVal = data.tailscale?.tunnelUrl || "";
        setTsUrl(tsUrlVal);
        setTsEnabled(tsEn);
        updateReachable(null, tsClientReachableRef, tsMissRef, setTsReachable, tsEverReachableRef, setTsEverReachable);
      }
    } catch (error) {
      console.log("Error loading settings:", error);
    } finally {
      setTunnelChecking(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTunnelDashboardAccess = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tunnelDashboardAccess: value }),
      });
      if (res.ok) setTunnelDashboardAccess(value);
    } catch (error) {
      console.log("Error updating tunnelDashboardAccess:", error);
    }
  };

  // u2500u2500u2500 Cloudflare Tunnel handlers
  // Ping tunnel health until reachable. Race multiple URLs (shortlink + direct) â€” 1 OK is enough.
  const pingTunnelHealth = async (...urls) => {
    setTunnelLoading(true);
    setTunnelProgress(translate("Waiting for tunnel ready..."));
    const targets = urls.filter(Boolean).map((u) => `${u}/api/health`);
    const start = Date.now();
    while (Date.now() - start < TUNNEL_PING_MAX_MS) {
      await new Promise((r) => setTimeout(r, TUNNEL_PING_INTERVAL_MS));
      const ok = await Promise.any(targets.map(async (h) => {
        const p = await fetch(h, { mode: "cors", cache: "no-store" });
        if (p.ok) return true;
        throw new Error("not ready");
      })).catch(() => false);
      if (ok) {
        setTunnelEnabled(true);
        setTunnelLoading(false);
        setTunnelProgress("");
        return true;
      }
      // Every 5 pings (~10s), check if backend process still alive
      if ((Date.now() - start) % 10000 < TUNNEL_PING_INTERVAL_MS) {
        try {
          const statusRes = await fetch("/api/tunnel/status");
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (!status.tunnel?.enabled) {
              setTunnelStatus({ type: "error", message: translate("Tunnel process stopped unexpectedly.") });
              setTunnelLoading(false);
              setTunnelProgress("");
              return false;
            }
          }
        } catch { /* ignore */ }
      }
    }
    setTunnelStatus({ type: "error", message: translate("Tunnel created but not reachable. Please try again.") });
    setTunnelLoading(false);
    setTunnelProgress("");
    return false;
  };

  const handleEnableTunnel = async () => {
    setShowEnableTunnelModal(false);
    setTunnelLoading(true);
    setTunnelStatus(null);
    setTunnelProgress(translate("Creating tunnel..."));

    // Poll download progress while enable request is pending
    let polling = true;
    const pollProgress = async () => {
      while (polling) {
        try {
          const r = await fetch("/api/tunnel/status");
          if (r.ok) {
            const s = await r.json();
            if (s.download?.downloading) {
              setTunnelProgress(`${translate("Downloading cloudflared...")} ${s.download.progress}%`);
            } else if (polling) {
              setTunnelProgress(translate("Creating tunnel..."));
            }
          }
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };
    pollProgress();

    try {
      const res = await fetch("/api/tunnel/enable", { method: "POST" });
      polling = false;
      const data = await res.json();
      if (!res.ok) {
        setTunnelStatus({ type: "error", message: data.error || translate("Failed to enable tunnel") });
        return;
      }

      const url = data.tunnelUrl;
      if (!url) {
        setTunnelStatus({ type: "error", message: translate("No tunnel URL returned") });
        return;
      }

      setTunnelUrl(url);
      setTunnelPublicUrl(data.publicUrl || "");
      await pingTunnelHealth(data.publicUrl, url);
    } catch (error) {
      setTunnelStatus({ type: "error", message: error.message });
    } finally {
      polling = false;
      setTunnelLoading(false);
      setTunnelProgress("");
    }
  };

  const handleDisableTunnel = async () => {
    setTunnelLoading(true);
    setTunnelStatus(null);
    try {
      const res = await fetch("/api/tunnel/disable", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTunnelEnabled(false);
        setTunnelUrl("");
        setShowDisableTunnelModal(false);
        setTunnelStatus({ type: "success", message: translate("Tunnel disabled") });
      } else {
        setTunnelStatus({ type: "error", message: data.error || translate("Failed to disable tunnel") });
      }
    } catch (error) {
      setTunnelStatus({ type: "error", message: error.message });
    } finally {
      setTunnelLoading(false);
    }
  };

  // u2500u2500u2500 Tailscale handlers
  const checkTailscaleInstalled = async () => {
    setTsInstalled(null);
    try {
      const res = await fetch("/api/tunnel/tailscale-check");
      if (res.ok) {
        const data = await res.json();
        setTsInstalled(data.installed);
        return data;
      }
    } catch { /* ignore */ }
    setTsInstalled(false);
    return { installed: false };
  };

  const handleInstallTailscale = async () => {
    setTsInstalling(true);
    setTsStatus(null);
    setTsInstallLog([]);
    try {
      const res = await fetch("/api/tunnel/tailscale-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sudoPassword: tsSudoPassword }),
      });
      setTsSudoPassword("");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const lines = part.split("\n");
          let event = "progress";
          let data = null;
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            if (line.startsWith("data: ")) {
              try { data = JSON.parse(line.slice(6)); } catch { /* skip */ }
            }
          }
          if (!data) continue;
          if (event === "progress") {
            setTsInstallLog((prev) => [...prev.slice(-50), data.message]);
          } else if (event === "done") {
            setTsInstalled(true);
            setTsInstalling(false);
            setShowTsModal(false);
            handleConnectTailscale();
            return;
          } else if (event === "error") {
            setTsStatus({ type: "error", message: data.error || "Install failed" });
          }
        }
      }
    } catch (e) {
      setTsStatus({ type: "error", message: e.message });
    } finally {
      setTsInstalling(false);
    }
  };

  // Ping Tailscale health until reachable
  const pingTsHealth = async (url) => {
    setTsProgress(translate("Waiting for Tailscale ready..."));
    const healthUrl = `${url}/api/health`;
    const start = Date.now();
    while (Date.now() - start < TUNNEL_PING_MAX_MS) {
      await new Promise((r) => setTimeout(r, TUNNEL_PING_INTERVAL_MS));
      try {
        const ping = await fetch(healthUrl, { mode: "no-cors", cache: "no-store" });
        if (ping.ok || ping.type === "opaque") return true;
      } catch { /* not ready yet */ }
    }
    return false;
  };

  // Show inline login button instead of auto-opening popup (browsers block popups
  // opened after async work because the user gesture is lost).
  const requestUserAuth = (url, label) => {
    setTsAuthUrl(url);
    setTsAuthLabel(label);
  };

  const clearUserAuth = () => {
    setTsAuthUrl("");
    setTsAuthLabel("");
  };

  const handleConnectTailscale = async () => {
    setShowTsModal(false);
    setTsConnecting(true);
    setTsLoading(true);
    setTsStatus(null);
    setTsProgress(translate("Connecting..."));
    clearUserAuth();
    try {
      const res = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        setTsUrl(data.tunnelUrl || "");
        const reachable = await pingTsHealth(data.tunnelUrl);
        setTsEnabled(true);
        setTsStatus(reachable ? null : { type: "warning", message: translate("Connected but not reachable yet.") });
        return;
      }

      if (data.needsLogin && data.authUrl) {
        requestUserAuth(data.authUrl, translate("Open Login Page"));
        setTsProgress(translate("Login required — click \"Open Login Page\" to continue"));
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const r2 = await fetch("/api/tunnel/tailscale-check");
            if (r2.ok) {
              const check = await r2.json();
              if (check.loggedIn) {
                clearUserAuth();
                setTsProgress(translate("Starting funnel..."));
                const res2 = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
                const data2 = await res2.json();
                if (res2.ok && data2.success) {
                  setTsUrl(data2.tunnelUrl || "");
                  const ok2 = await pingTsHealth(data2.tunnelUrl);
                  setTsEnabled(true);
                  setTsStatus(ok2 ? null : { type: "warning", message: translate("Connected but not reachable yet.") });
                } else if (data2.funnelNotEnabled && data2.enableUrl) {
                  await pollFunnelEnable(data2.enableUrl);
                } else {
                  setTsStatus({ type: "error", message: data2.error || translate("Failed to start funnel") });
                }
                return;
              }
            }
          } catch { /* retry */ }
        }
        clearUserAuth();
        setTsStatus({ type: "error", message: translate("Login timed out. Please try again.") });
        return;
      }

      if (data.funnelNotEnabled && data.enableUrl) {
        await pollFunnelEnable(data.enableUrl);
        return;
      }

      setTsStatus({ type: "error", message: data.error || translate("Failed to connect") });
    } catch (error) {
      setTsStatus({ type: "error", message: error.message });
    } finally {
      setTsLoading(false);
      setTsConnecting(false);
      setTsProgress("");
      clearUserAuth();
    }
  };

  const pollFunnelEnable = async (enableUrl) => {
    requestUserAuth(enableUrl, translate("Open Funnel Settings"));
    setTsProgress(translate("Click \"Open Funnel Settings\" to enable Funnel..."));
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.success) {
          clearUserAuth();
          setTsUrl(data.tunnelUrl || "");
          const ok3 = await pingTsHealth(data.tunnelUrl);
          setTsEnabled(true);
          setTsStatus(ok3 ? null : { type: "warning", message: translate("Connected but not reachable yet.") });
          return;
        }
        if (data.funnelNotEnabled) continue;
        if (data.error) {
          clearUserAuth();
          setTsStatus({ type: "error", message: data.error });
          return;
        }
      } catch { /* retry */ }
    }
    clearUserAuth();
    setTsStatus({ type: "error", message: translate("Timed out waiting for Funnel to be enabled.") });
  };

  const handleDisableTailscale = async () => {
    setTsLoading(true);
    setTsStatus(null);
    try {
      const res = await fetch("/api/tunnel/tailscale-disable", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTsEnabled(false);
        setTsUrl("");
        setShowDisableTsModal(false);
        setTsStatus({ type: "success", message: translate("Tailscale disabled") });
      } else {
        setTsStatus({ type: "error", message: data.error || translate("Failed to disable Tailscale") });
      }
    } catch (e) {
      setTsStatus({ type: "error", message: e.message });
    } finally {
      setTsLoading(false);
    }
  };

  const handleOpenTsModal = async () => {
    setTsStatus(null);
    setTsInstallLog([]);
    const data = await checkTailscaleInstalled();
    if (data?.installed && data?.hasCachedPassword) {
      handleConnectTailscale();
    } else {
      setShowTsModal(true);
    }
  };

  // Three canonical endpoint addresses:
  //   Local  — always the loopback URL (works on the machine itself)
  //   Server — reachable address of this box: browser origin when it is an IP
  //            literal, else the server-detected public IP + app port
  //   Domain — shown only when the dashboard is being accessed via a hostname
  const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
  const browsingHost = originInfo.hostname;
  const browsingLocal = ["localhost", "127.0.0.1", "::1"].includes(browsingHost);
  const browsingIp = !!browsingHost && (IPV4_RE.test(browsingHost) || browsingHost.includes(":"));
  const localUrl = `http://localhost:${serverPort}/v1`;
  const serverUrl = !browsingLocal && originInfo.origin && browsingIp
    ? `${originInfo.origin}/v1`
    : publicIp
      ? `http://${publicIp}:${serverPort}/v1`
      : "";
  const domainUrl = !browsingLocal && !browsingIp && originInfo.origin
    ? `${originInfo.origin}/v1`
    : "";

  const [showRemoteAccessModal, setShowRemoteAccessModal] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "api", label: translate("API & Models") },
          { id: "mcp", label: "MCP" },
          { id: "a2a", label: "A2A" },
          { id: "remote", label: translate("Remote Access") },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "primary" : "ghost"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "api" && (
        <div className="flex flex-col gap-6">
      {/* Endpoint URLs - at the top */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/50 px-5 py-4">
          <span className="material-symbols-outlined text-lg text-primary">link</span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{translate("Endpoint URLs")}</h2>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <EndpointRow label="Local" url={localUrl} copyId="local_url" copied={copied} onCopy={copy} />
          {serverUrl && (
            <EndpointRow label="Server" url={serverUrl} copyId="server_url" copied={copied} onCopy={copy} />
          )}
          {domainUrl && (
            <EndpointRow label="Domain" url={domainUrl} copyId="domain_url" copied={copied} onCopy={copy} />
          )}
          {/* LAN interface rows are only meaningful while browsing on the machine itself */}
          {browsingLocal && lanIps.length > 0 && lanIps.map(({ iface, ip }) => (
            <EndpointRow
              key={`${iface}-${ip}`}
              label={iface || "IP"}
              url={`http://${ip}:${serverPort}/v1`}
              copyId={`ip_${ip}`}
              copied={copied}
              onCopy={copy}
            />
          ))}
        </div>
      </Card>
      </div>
      )}

      {activeTab === "mcp" && <MCPSection />}
      {activeTab === "a2a" && <A2ASection />}
      {activeTab === "remote" && (
        <div className="flex flex-col gap-6">
          {/* Live catalog of routable models, grouped by capability */}
          <ModelsExplorer />

          {/* Remote access */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Cloudflare Tunnel */}
            <Card className="flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">cloud_upload</span>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{translate("Cloudflare Tunnel")}</h2>
                </div>
                <EndpointStatusBadge
                  status={
                    tunnelEnabled && !tunnelLoading && tunnelReachable ? "online" :
                    tunnelEnabled && !tunnelLoading && !tunnelReachable ? "connecting" :
                    tunnelLoading || tunnelChecking ? "loading" :
                    tunnelStatus?.type === "error" ? "error" :
                    "offline"
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                <p className="text-sm text-text-muted">
                  {translate("Expose NovaRoute to the internet with a public URL. No port forwarding or static IP required.")}
                </p>
                {tunnelEnabled && !tunnelLoading && tunnelReachable ? (
                  <div className="flex items-center gap-2">
                    <Input value={`${tunnelPublicUrl || tunnelUrl}/v1`} readOnly className="flex-1 font-mono text-sm" />
                    <EndpointIconButton
                      icon={copied === "tunnel_url" ? "check" : "content_copy"}
                      onClick={() => copy(`${tunnelPublicUrl || tunnelUrl}/v1`, "tunnel_url")}
                    />
                    <EndpointIconButton
                      icon="power_settings_new"
                      danger
                      onClick={() => setShowDisableTunnelModal(true)}
                      title={translate("Disable Tunnel")}
                    />
                  </div>
                ) : tunnelEnabled && !tunnelLoading && !tunnelReachable ? (
                  <StatusRow
                    type="warning"
                    message={tunnelEverReachable ? translate("Tunnel reconnecting...") : translate("Tunnel checking...")}
                    action={{
                      icon: "power_settings_new",
                      danger: true,
                      onClick: () => setShowDisableTunnelModal(true),
                      title: translate("Disable Tunnel"),
                    }}
                  />
                ) : tunnelLoading ? (
                  <StatusRow
                    type="loading"
                    message={tunnelProgress || translate("Creating tunnel...")}
                    action={{
                      icon: "power_settings_new",
                      danger: true,
                      onClick: () => { setTunnelLoading(false); setTunnelProgress(""); },
                      title: translate("Stop"),
                    }}
                  />
                ) : tunnelStatus?.type === "error" ? (
                  <div className="flex flex-col gap-3">
                    <StatusRow type="error" message={tunnelStatus.message} />
                    <Button size="sm" icon="cloud_upload" onClick={() => setShowEnableTunnelModal(true)} fullWidth>
                      {translate("Enable Tunnel")}
                    </Button>
                  </div>
                ) : tunnelChecking ? (
                  <StatusRow
                    type="loading"
                    message={translate("Checking...")}
                    action={{
                      icon: "power_settings_new",
                      danger: true,
                      onClick: () => setTunnelChecking(false),
                      title: translate("Stop"),
                    }}
                  />
                ) : (
                  <Button
                    size="sm"
                    icon="cloud_upload"
                    onClick={() => {
                      if (isLoginUnsafe) {
                        setTunnelStatus({ type: "error", message: `${translate("Security required:")} ${unsafeReason}` });
                        return;
                      }
                      if (!requireApiKey) {
                        setTunnelStatus({ type: "error", message: translate("Security required: Enable \"Require API key\" before activating the tunnel.") });
                        return;
                      }
                      setShowEnableTunnelModal(true);
                    }}
                    fullWidth
                  >
                    {translate("Enable Tunnel")}
                  </Button>
                )}
              </div>
            </Card>

            {/* Tailscale */}
            <Card className="flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">vpn_lock</span>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{translate("Tailscale Funnel")}</h2>
                </div>
                <EndpointStatusBadge
                  status={
                    tsEnabled && !tsLoading && !tsConnecting && tsReachable ? "online" :
                    tsEnabled && !tsLoading && !tsConnecting && !tsReachable ? "connecting" :
                    tsLoading || tsConnecting ? "loading" :
                    tsStatus?.type === "error" ? "error" :
                    "offline"
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                <p className="text-sm text-text-muted">
                  {translate("Connect via Tailscale for a secure private tunnel to your NovaRoute instance.")}
                </p>
                {tsEnabled && !tsLoading && !tsConnecting && tsReachable ? (
                  <div className="flex items-center gap-2">
                    <Input value={`${tsUrl}/v1`} readOnly className="flex-1 font-mono text-sm" />
                    <EndpointIconButton
                      icon={copied === "ts_url" ? "check" : "content_copy"}
                      onClick={() => copy(`${tsUrl}/v1`, "ts_url")}
                    />
                    <EndpointIconButton
                      icon="power_settings_new"
                      danger
                      onClick={() => setShowDisableTsModal(true)}
                      title={translate("Disable Tailscale")}
                    />
                  </div>
                ) : tsEnabled && !tsLoading && !tsConnecting && !tsReachable ? (
                  <StatusRow
                    type="warning"
                    message={tsEverReachable ? translate("Tunnel reconnecting...") : translate("Tunnel checking...")}
                    action={{
                      icon: "power_settings_new",
                      danger: true,
                      onClick: () => setShowDisableTsModal(true),
                      title: translate("Disable Tailscale"),
                    }}
                  />
                ) : tsLoading || tsConnecting ? (
                  <StatusRow
                    type="loading"
                    message={tsProgress || translate("Creating tunnel...")}
                    action={{
                      icon: "power_settings_new",
                      danger: true,
                      onClick: () => { setTsLoading(false); setTsProgress(""); },
                      title: translate("Stop"),
                    }}
                  />
                ) : tsStatus?.type === "error" ? (
                  <div className="flex flex-col gap-3">
                    <StatusRow type="error" message={tsStatus.message} />
                    <Button size="sm" icon="vpn_lock" onClick={handleOpenTsModal} fullWidth>
                      {translate("Enable Tailscale")}
                    </Button>
                  </div>
                ) : tsInstalled === false ? (
                  <div className="flex flex-col gap-3">
                    <StatusRow type="warning" message={translate("Tailscale is not installed on this system.")} />
                    <Button size="sm" icon="download" onClick={handleInstallTs} loading={tsInstalling} fullWidth>
                      {translate("Install Tailscale")}
                    </Button>
                  </div>
                ) : tsInstalled === null ? (
                  <StatusRow type="loading" message={translate("Checking Tailscale installation...")} />
                ) : (
                  <Button
                    size="sm"
                    icon="vpn_lock"
                    onClick={() => {
                      if (isLoginUnsafe) {
                        setTsStatus({ type: "error", message: `${translate("Security required:")} ${unsafeReason}` });
                        return;
                      }
                      handleOpenTsModal();
                    }}
                    fullWidth
                  >
                    {translate("Enable Tailscale")}
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Security */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-surface-2/50 px-5 py-4">
              <span className="material-symbols-outlined text-lg text-primary">security</span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">{translate("Security")}</h2>
            </div>
            <div className="flex flex-col gap-3 p-5">
              {isLoginUnsafe && !tunnelEnabled && !tsEnabled && (
                <SecurityWarning message={unsafeReason} action={{ label: translate("Open settings"), href: "/dashboard/profile" }} />
              )}

              {(tunnelEnabled || tsEnabled) && (
                <>
                  {!requireApiKey && (
                    <SecurityWarning
                      message={translate("Require API key is disabled — your endpoint is publicly accessible without authentication.")}
                      action={{ label: translate("Enable"), href: "/dashboard/api-keys" }}
                    />
                  )}
                  {(!requireLogin || !hasPassword) && (
                    <SecurityWarning
                      message={
                        !requireLogin
                          ? translate("Require login is disabled — anyone can access your dashboard via tunnel.")
                          : translate("Dashboard uses the default password — change it in Profile settings.")
                      }
                      action={{
                        label: !requireLogin ? translate("Enable") : translate("Change password"),
                        href: "/dashboard/profile",
                      }}
                    />
                  )}
                  <div className="mt-2 flex items-center gap-3 border-t border-border pt-3">
                    <Toggle
                      checked={tunnelDashboardAccess}
                      onChange={() => handleTunnelDashboardAccess(!tunnelDashboardAccess)}
                    />
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{translate("Allow dashboard access via tunnel")}</p>
                      <Tooltip text={translate("When enabled, the dashboard can be accessed through your tunnel or Tailscale URL (login still required). When disabled, dashboard access via tunnel/Tailscale is completely blocked.")} />
                    </div>
                  </div>
                </>
              )}

              {!isLoginUnsafe && !tunnelEnabled && !tsEnabled && (
                <p className="flex items-center gap-2 text-sm text-text-muted">
                  <span className="material-symbols-outlined text-lg text-green-500">check_circle</span>
                  {translate("Your endpoint is only accessible locally. Enable a tunnel above for remote access.")}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function EndpointStatusBadge({ status }) {
  const styles = {
    online: { wrapper: "bg-green-500/10 text-green-600 border-green-500/20", icon: "check_circle", label: translate("Online") },
    connecting: { wrapper: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: "progress_activity", label: translate("Connecting") },
    loading: { wrapper: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: "progress_activity", label: translate("Loading...") },
    error: { wrapper: "bg-red-500/10 text-red-600 border-red-500/20", icon: "error", label: translate("Error") },
    offline: { wrapper: "bg-surface-2 text-text-muted border-border", icon: "cloud_off", label: translate("Offline") },
  };
  const s = styles[status] || styles.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.wrapper}`}>
      <span className={`material-symbols-outlined text-[14px] ${status === "loading" || status === "connecting" ? "animate-spin" : ""}`}>{s.icon}</span>
      {s.label}
    </span>
  );
}

function EndpointIconButton({ icon, onClick, danger, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

function StatusRow({ type, message, action }) {
  const styles = {
    warning: "border-amber-300 bg-amber-500/5 text-amber-700 dark:border-amber-800 dark:text-amber-400",
    loading: "border-border bg-input text-text-muted",
    error: "border-red-300 bg-red-500/5 text-red-700 dark:border-red-800 dark:text-red-400",
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${styles[type]}`}>
      <span className={`material-symbols-outlined text-sm ${type === "loading" ? "animate-spin" : ""}`}>
        {type === "warning" ? "progress_activity" : type === "loading" ? "progress_activity" : "error"}
      </span>
      <span className="flex-1">{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          title={action.title}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            action.danger
              ? "text-red-500 hover:bg-red-500/10"
              : "text-text-muted hover:bg-black/5 hover:text-primary dark:hover:bg-white/5"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
        </button>
      )}
    </div>
  );
}
