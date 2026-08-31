"use client";

import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useSidebarSearchStore } from "@/store/sidebarSearchStore";
import Button from "./Button";
import { ConfirmModal } from "./Modal";
import { translate } from "@/i18n/runtime";

// Primary actions — always at the top of the navigation.
const PRIMARY_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/endpoint", label: "Endpoint", icon: "api" },
  { href: "/dashboard/api-keys", label: "API Key", icon: "key" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  { href: "/dashboard/combos", label: "Combos", icon: "layers" },
  { href: "/dashboard/nova-bot", label: "Nova Bot", icon: "hub" },
  { href: "/dashboard/apps", label: "Apps", icon: "apps" },
];

const CONSUMPTION_ITEMS = [
  { href: "/dashboard/usage/analytics", label: "Analytics", icon: "query_stats" },
  { href: "/dashboard/usage", label: "Usage Details", icon: "bar_chart" },
  { href: "/dashboard/quota", label: "Quota Tracker", icon: "data_usage" },
  { href: "/dashboard/cache", label: "Semantic Cache", icon: "database" },
];

const TOOLS_ITEMS = [
  { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
  { href: "/dashboard/skills", label: "Skills", icon: "extension" },
  { href: "/dashboard/combos/playground", label: "Combo Playground", icon: "lab_profile" },
  { href: "/dashboard/tokens", label: "Redeem Tokens", icon: "confirmation_number" },
];

const ADVANCED_ITEMS = [
  { href: "/dashboard/security", label: "Security", icon: "shield" },
  { href: "/dashboard/monitoring", label: "Monitoring", icon: "monitor_heart" },
  { href: "/dashboard/virtual-keys", label: "Virtual Keys", icon: "vpn_key" },
  { href: "/dashboard/guardrails", label: "Guardrails", icon: "privacy_tip" },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: "storefront" },
  { href: "/dashboard/compliance", label: "Compliance", icon: "verified_user" },
];

const MORE_ITEMS = [
  { href: "/dashboard/logs", label: "Request Logs", icon: "history" },
  { href: "/dashboard/console-log", label: "Console Log", icon: "terminal" },
];

const SOCIALS = [
  { href: "https://novaproxy.online", title: "Website", className: "wb", svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg> },
  { href: "https://t.me/irnova_proxy", title: "Telegram", className: "tg", svg: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.94 4.6 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19l-10.63 6.7-4.58-1.43c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.31 1.56.19 1.29 1.45z" /></svg> },
  { href: "https://www.youtube.com/@novaproxyir", title: "YouTube", className: "yt", svg: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.76-1.77C19.34 5.13 12 5.13 12 5.13s-7.34 0-8.84.4A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.76 1.77c1.5.4 8.84.4 8.84.4s7.34 0 8.84-.4a2.5 2.5 0 0 0 1.76-1.77C23 15.2 23 12 23 12zM9.75 15.5v-7l6.25 3.5-6.25 3.5z" /></svg> },
  { href: "https://instagram.com/irnova_proxy", title: "Instagram", className: "ig", svg: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153.509.5.902 1.105 1.153 1.772.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772c-.5.508-1.105.902-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" /></svg> },
  { href: "https://x.com/irNovaProxy", title: "X (@irNovaProxy)", className: "x", svg: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> },
];

const CSS = `
.nova-side{
  --sidew:264px;
  width:var(--sidew); flex:0 0 var(--sidew);
  /* Opaque surface: the sidebar doubles as a mobile drawer overlaying content,
     so translucent --card would let the page bleed through. --elevated is the
     design token meant exactly for menus/popovers (solid in both themes). */
  background:var(--elevated, var(--card));
  border-inline-end:1px solid var(--bd);
  height:100vh; position:sticky; top:0;
  display:flex; flex-direction:column;
  padding:16px 14px 12px; gap:4px;
  overflow:hidden;
}
.nova-side *{box-sizing:border-box}
.nova-side .brand{display:flex;align-items:center;gap:11px;padding:2px 2px 6px}
.nova-side .mark{width:40px;height:40px;flex:0 0 40px;display:flex;align-items:center;justify-content:center;background:var(--c2);border:1px solid var(--bd);border-radius:11px;overflow:hidden}
.nova-side .mark img{width:26px;height:26px;object-fit:contain;display:block}
.nova-side .brand .name{font-size:15px;font-weight:800;color:var(--tx);letter-spacing:-.2px;line-height:1.2}
.nova-side .brand .env{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mu);margin-top:2px}
.nova-side .brand .env .d{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 22%,transparent)}
.nova-side .upd{border:1px solid var(--bd);border-radius:10px;background:var(--c2);padding:8px 10px;margin:2px 0 6px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:.13s}
.nova-side .upd:hover{border-color:var(--ac)}
.nova-side .upd .mi{font-size:16px;color:var(--ac)}
.nova-side .upd span{font-size:11px;font-weight:600;color:var(--tx2);line-height:1.4}
.nova-side .nav{flex:1;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:2px;padding:2px;margin:0 -2px}
.nova-side .nav::-webkit-scrollbar{width:5px}
.nova-side .nav::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:999px}
.nova-side .nav-sec{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mu);padding:12px 10px 5px}
.nova-side .nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;color:var(--tx2);font-size:13px;font-weight:500;cursor:pointer;transition:.13s;border:1px solid transparent;width:100%;background:transparent;font-family:inherit;text-align:start;text-decoration:none}
.nova-side .nav-item .mi{font-size:18px;color:var(--mu);transition:.13s;flex:0 0 auto;line-height:1}
.nova-side .nav-item .lb{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nova-side .nav-item:hover{background:var(--c2);color:var(--tx)}
.nova-side .nav-item:hover .mi{color:var(--ac)}
.nova-side .nav-item.active{background:var(--c2);color:var(--tx);border-color:var(--bd);position:relative}
.nova-side .nav-item.active .mi{color:var(--ac)}
.nova-side .nav-item.active::before{content:"";position:absolute;inset-inline-start:-14px;top:22%;bottom:22%;width:3px;border-radius:999px;background:var(--grad)}
.nova-side .chev{margin-inline-start:auto;color:var(--mu);transition:.15s;font-size:16px;flex:0 0 auto}
.nova-side .sub{display:flex;flex-direction:column;gap:2px;padding-inline-start:18px}
.nova-side .side-foot{margin-top:auto;padding-top:10px;border-top:1px solid var(--bd);display:flex;flex-direction:column;gap:8px}
.nova-side .social{display:flex;justify-content:center;gap:5px;padding:2px 0}
.nova-side .social a{width:31px;height:31px;display:inline-flex;align-items:center;justify-content:center;border-radius:9px;border:1px solid var(--bd);background:var(--card);color:var(--tx2);transition:.13s;text-decoration:none}
.nova-side .social a:hover{color:var(--ac);border-color:var(--bd2);transform:translateY(-1px)}
.nova-side .social svg{width:15px;height:15px}
.nova-side .social .tg{color:#229ED9}
.nova-side .social .yt{color:#FF0000}
.nova-side .social .ig{color:#E1306C}
.nova-side .logout{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:9px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--dg) 25%,transparent);background:color-mix(in srgb,var(--dg) 7%,transparent);color:var(--dg);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:.13s}
.nova-side .logout:hover{background:color-mix(in srgb,var(--dg) 13%,transparent)}
.nova-side .logout .mi{font-size:17px;line-height:1}
.nova-side .ver{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--mu);padding:1px 6px}
.nova-side .ver b{font-weight:700;color:var(--tx2);font-variant-numeric:tabular-nums}
.nova-side .ver .up{color:var(--ok);cursor:pointer;font-weight:700}
.nova-side .ver .up:hover{text-decoration:underline}
`;

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const { query } = useSidebarSearchStore();
  const { copied, copy } = useCopyToClipboard(2000);

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => { if (data.enableTranslator) setEnableTranslator(true); })
      .catch(() => {});
  }, []);

  // Lazy check for new npm version on mount
  useEffect(() => {
    fetch("/api/version")
      .then((res) => res.json())
      .then((data) => { if (data.hasUpdate) setUpdateInfo(data); })
      .catch(() => {});
  }, []);
  const isActive = useCallback((href) => {
    // Hash anchors are shortcuts to a category on the providers page; the
    // "Providers" primary item already highlights for the whole page.
    if (href.includes("#")) return false;
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (!pathname.startsWith(href)) return false;
    // Path-boundary: /dashboard/usage must NOT match /dashboard/usagefoo.
    const rest = pathname.slice(href.length);
    if (rest !== "" && !rest.startsWith("/")) return false;
    // Longest-match wins: a parent path (/dashboard/usage) must never stay
    // active alongside a more specific child (/dashboard/usage/analytics).
    const allHrefs = [
      ...PRIMARY_ITEMS,
      ...CONSUMPTION_ITEMS,
      ...TOOLS_ITEMS,
      ...ADVANCED_ITEMS,
      ...MORE_ITEMS,
      { href: "/dashboard/translator" },
      { href: "/dashboard/profile" },
    ].map((i) => i.href);
    const hasBetterMatch = allHrefs.some(
      (h) => h !== href && h.startsWith(`${href}/`) && pathname.startsWith(h)
    );
    return !hasBetterMatch;
  }, [pathname]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) window.location.assign("/login");
    } catch { /* ignore */ }
  };

  // Open manual update panel (no countdown yet — user must click Copy to trigger shutdown)
  const handleUpdate = () => {
    setShowUpdateModal(false);
    setIsUpdating(true);
  };

  // Triggered by Copy button inside ManualUpdatePanel: copy + countdown + shutdown
  const handleCopyAndShutdown = async () => {
    try { await navigator.clipboard.writeText(INSTALL_CMD); } catch { /* clipboard blocked */ }
    copy(INSTALL_CMD);
    let remaining = UPDATER_CONFIG.shutdownCountdownSec;
    setShutdownCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      setShutdownCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        fetch("/api/version/shutdown", { method: "POST" }).catch(() => {});
        setIsDisconnected(true);
      }
    }, 1000);
  };

  const handleCancelUpdate = () => {
    setIsUpdating(false);
    setShutdownCountdown(0);
  };

  const q = query.trim().toLowerCase();
  const matches = (label) => !q || translate(label).toLowerCase().includes(q);

  const isConsumptionActive = ["/dashboard/usage", "/dashboard/costs", "/dashboard/provider-stats", "/dashboard/report", "/dashboard/quota", "/dashboard/cache"].some((p) => pathname.startsWith(p));
  const consumptionVisible = CONSUMPTION_ITEMS.some((i) => matches(i.label)) || isConsumptionActive;

  const isToolsActive = ["/dashboard/token-saver", "/dashboard/cli-tools", "/dashboard/proxy-pools", "/dashboard/skills", "/dashboard/combos/playground", "/dashboard/tokens"].some((p) => pathname.startsWith(p));
  const toolsVisible = TOOLS_ITEMS.some((i) => matches(i.label)) || isToolsActive;

  const isAdvancedActive = ADVANCED_ITEMS.some((i) => pathname.startsWith(i.href));
  const advancedVisible = ADVANCED_ITEMS.some((i) => matches(i.label)) || isAdvancedActive;

  const renderItem = (item, sub) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={onClose}
      className={cn("nav-item", isActive(item.href) && "active")}
    >
      <span className="mi material-symbols-outlined">{item.icon}</span>
      <span className="lb">{translate(item.label)}</span>
      {sub}
    </Link>
  );

  return (
    <>
      <aside className="nova-side">
        <style>{CSS}</style>

        {/* Brand */}
        <div className="brand">
          <div className="mark">
            <img src="/logo-mark.svg" alt="NovaRoute" />
          </div>
          <div>
            <div className="name">{APP_CONFIG.name}</div>
            <div className="env"><span className="d" /><span>{translate("Operational")}</span></div>
          </div>
        </div>

        {/* Update available */}
        {updateInfo && (
          <button className="upd" onClick={() => setShowUpdateModal(true)} type="button">
            <span className="mi material-symbols-outlined">upgrade</span>
            <span>{translate("New version available")} v{updateInfo.latestVersion}</span>
          </button>
        )}

        {/* Navigation */}
        <nav className="nav">
          {/* Primary actions — always at the top */}
          {PRIMARY_ITEMS.filter((i) => matches(i.label)).map((i) => renderItem(i))}

          {/* Consumption submenu */}
          {consumptionVisible && (
            <>
              <button
                type="button"
                onClick={() => setConsumptionOpen((v) => !v)}
                className={cn("nav-item", isConsumptionActive && "active")}
              >
                <span className="mi material-symbols-outlined">speed</span>
                <span className="lb">{translate("Consumption")}</span>
                <span className="chev material-symbols-outlined" style={{ transform: consumptionOpen ? "rotate(180deg)" : "rotate(0deg)" }}>expand_more</span>
              </button>
              {(consumptionOpen || q) && (
                <div className="sub">
                  {CONSUMPTION_ITEMS.filter((i) => matches(i.label)).map((i) => renderItem(i))}
                </div>
              )}
            </>
          )}

          {/* Tools submenu */}
          {toolsVisible && (
            <>
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                className={cn("nav-item", isToolsActive && "active")}
              >
                <span className="mi material-symbols-outlined">handyman</span>
                <span className="lb">{translate("Tools")}</span>
                <span className="chev material-symbols-outlined" style={{ transform: toolsOpen ? "rotate(180deg)" : "rotate(0deg)" }}>expand_more</span>
              </button>
              {(toolsOpen || q) && (
                <div className="sub">
                  {TOOLS_ITEMS.filter((i) => matches(i.label)).map((i) => renderItem(i))}
                </div>
              )}
            </>
          )}

          {/* Advanced submenu */}
          {advancedVisible && (
            <>
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className={cn("nav-item", isAdvancedActive && "active")}
              >
                <span className="mi material-symbols-outlined">tune</span>
                <span className="lb">{translate("Advanced")}</span>
                <span className="chev material-symbols-outlined" style={{ transform: advancedOpen ? "rotate(180deg)" : "rotate(0deg)" }}>expand_more</span>
              </button>
              {(advancedOpen || q) && (
                <div className="sub">
                  {ADVANCED_ITEMS.filter((i) => matches(i.label)).map((i) => renderItem(i))}
                </div>
              )}
            </>
          )}

          {/* Everything else lives below */}
          {MORE_ITEMS.filter((i) => matches(i.label)).map((i) => renderItem(i))}

          {(enableTranslator || q) && matches("Translator") && renderItem({ href: "/dashboard/translator", label: "Translator", icon: "translate" })}

          {/* Settings */}
          {matches("Settings") && renderItem({ href: "/dashboard/profile", label: "Settings", icon: "settings" })}

        </nav>

        {/* Footer */}
        <div className="side-foot">
          <div className="social">
            {SOCIALS.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener" title={s.title} aria-label={s.title}>
                {s.svg}
              </a>
            ))}
          </div>
          <button className="logout" type="button" onClick={handleLogout}>
            <span className="mi material-symbols-outlined">logout</span>
            {translate("Logout")}
          </button>
          <div className="ver">
            <span>{translate("Version")} <b dir="ltr">{APP_CONFIG.versionLabel}</b></span>
            {updateInfo ? (
              <span className="up" onClick={() => setShowUpdateModal(true)}>{translate("Update")}</span>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Update Confirmation Modal */}
      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title={translate("Update NovaRoute")}
        message={`Show install command for v${updateInfo?.latestVersion || ""}? You can copy it and shutdown to install manually.`}
        confirmText={translate("Show Command")}
        cancelText={translate("Cancel")}
        variant="primary"
      />

      {/* Disconnected / Updating Overlay */}
      {(isDisconnected || isUpdating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          {isUpdating ? (
            <ManualUpdatePanel
              latestVersion={updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={handleCancelUpdate}
              countdown={shutdownCountdown}
              isDisconnected={isDisconnected}
            />
          ) : (
            <div className="text-center p-8">
              <div className="flex items-center justify-center size-16 rounded-full bg-danger/20 text-danger mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="text-xl font-semibold text-text-main mb-2">{translate("Server Disconnected")}</h2>
              <p className="text-text-muted mb-6">{translate("The proxy server has been stopped.")}</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Reload Page
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};

function ManualUpdatePanel({ latestVersion, installCmd, copied, onCopyAndShutdown, onCancel, countdown, isDisconnected }) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-brand-lg bg-elevated border border-border p-6 text-text-main">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center size-11 rounded-full bg-warning/20 text-warning">
          <span className="material-symbols-outlined text-[24px]">content_copy</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Update NovaRoute{latestVersion ? ` to v${latestVersion}` : ""}</h2>
          <p className="text-xs text-text-muted">
            {isDisconnected
              ? "Server stopped. Paste the command into a terminal to install."
              : isCountingDown
                ? `Command copied. Server will stop in ${countdown}s...`
                : "Click the button below to copy the install command and shutdown."}
          </p>
        </div>
      </div>

      <p className="text-sm text-text-2 mb-2">Install command:</p>
      <div className="w-full px-3 py-2 rounded bg-white/5 mb-4">
        <code className="text-xs font-mono text-warning break-all">{installCmd}</code>
      </div>

      <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside mb-4">
        <li>Click <strong>Copy & Shutdown</strong> below.</li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>Run <code className="px-1 rounded bg-white/10 text-success">NovaRoute</code> again after install.</li>
      </ol>

      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>
          Reload Page
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={onCopyAndShutdown} disabled={isCountingDown}>
            {copied ? "✓ Copied — shutting down..." : isCountingDown ? `Shutting down in ${countdown}s` : "Copy & Shutdown"}
          </Button>
        </div>
      )}
    </div>
  );
}

ManualUpdatePanel.propTypes = {
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopyAndShutdown: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  countdown: PropTypes.number,
  isDisconnected: PropTypes.bool,
};
