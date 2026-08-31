"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PropTypes from "prop-types";
import ProviderIcon from "@/shared/components/ProviderIcon";
import DonateModal from "@/shared/components/DonateModal";
import { useTheme } from "@/shared/hooks/useTheme";
import { useSidebarSearchStore } from "@/store/sidebarSearchStore";
import { useNotificationStore } from "@/store/notificationStore";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS, AI_PROVIDERS } from "@/shared/constants/providers";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";
import { translate } from "@/i18n/runtime";
import { LOCALE_COOKIE, normalizeLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { reloadTranslations } from "@/i18n/runtime";

const getPageInfo = (pathname) => {
  if (!pathname) return { title: "", description: "", breadcrumbs: [] };

  // Media provider detail: /dashboard/media-providers/[kind]/[id]
  const mediaDetailMatch = pathname.match(/\/media-providers\/([^/]+)\/([^/]+)$/);
  if (mediaDetailMatch) {
    const kindId = mediaDetailMatch[1];
    const providerId = mediaDetailMatch[2];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    const provider = AI_PROVIDERS[providerId];
    return {
      title: provider?.name || providerId,
      description: "",
      breadcrumbs: [
        { label: "Media Providers", href: `/dashboard/providers#${kindId === "webSearch" || kindId === "webFetch" ? "web" : kindId}` },
        { label: kindConfig?.label || kindId, href: `/dashboard/providers#${kindId === "webSearch" || kindId === "webFetch" ? "web" : kindId}` },
        { label: provider?.name || providerId, image: getProviderIconSrc(providerId) },
      ],
    };
  }

  // Media provider kind: /dashboard/media-providers/[kind]
  const mediaKindMatch = pathname.match(/\/media-providers\/([^/]+)$/);
  if (mediaKindMatch) {
    const kindId = mediaKindMatch[1];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    return {
      title: kindConfig?.label || kindId,
      description: `Manage your ${kindConfig?.label || kindId} providers`,
      icon: kindConfig?.icon || "perm_media",
      breadcrumbs: [],
    };
  }

  // Provider detail page: /dashboard/providers/[id]
  const providerMatch = pathname.match(/\/providers\/([^/]+)$/);
  if (providerMatch) {
    const providerId = providerMatch[1];
    const providerInfo =
      OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId];
    if (providerInfo) {
      return {
        title: providerInfo.name,
        description: "",
        breadcrumbs: [
          { label: "Providers", href: "/dashboard/providers" },
          {
            label: providerInfo.name,
            image: getProviderIconSrc(providerInfo.id),
          },
        ],
      };
    }
  }

  if (pathname.includes("/providers") && !pathname.includes("/media-providers"))
    return {
      title: translate("Providers"),
      description: translate("Manage your AI provider connections"),
      icon: "dns",
      breadcrumbs: [],
    };
  if (pathname.includes("/combos/playground"))
    return {
      title: translate("Combo Playground"),
      description: translate("Test your combo routing strategies live"),
      icon: "lab_profile",
      breadcrumbs: [],
    };
  if (pathname.includes("/combos"))
    return {
      title: translate("Combos"),
      description: translate("Model combos with fallback"),
      icon: "layers",
      breadcrumbs: [],
    };
  if (pathname.includes("/costs"))
    return {
      title: translate("Costs"),
      description:
        "Spend breakdown, cost trends, and monthly budget tracking",
      icon: "payments",
      breadcrumbs: [],
    };
  if (pathname.includes("/provider-stats"))
    return {
      title: translate("Provider Stats"),
      description: translate("Per-provider usage, cost, and health"),
      icon: "monitoring",
      breadcrumbs: [],
    };
  if (pathname.includes("/cache"))
    return {
      title: translate("Semantic Cache"),
      description: translate("Embedding-indexed cached responses"),
      icon: "database",
      breadcrumbs: [],
    };
  if (pathname.includes("/tokens"))
    return {
      title: translate("Redeem Tokens"),
      description: translate("Generate and redeem usage credits"),
      icon: "confirmation_number",
      breadcrumbs: [],
    };
  if (pathname.includes("/settings"))
    return {
      title: translate("Settings"),
      description: "Global application configuration",
      icon: "settings",
      breadcrumbs: [],
    };
  if (pathname.includes("/usage"))
    return {
      title: translate("Usage & Analytics"),
      description:
        "Monitor your API usage, token consumption, and request logs",
      icon: "bar_chart",
      breadcrumbs: [],
    };
  if (pathname.includes("/report"))
    return {
      title: translate("Report"),
      description:
        "Predictive routing and semantic cache analytics",
      icon: "assessment",
      breadcrumbs: [],
    };
  if (pathname.includes("/auth-files"))
    return {
      title: translate("Auth Files"),
      description: translate("Map provider credentials stored in the local database"),
      icon: "vpn_key",
      breadcrumbs: [],
    };
  if (pathname.includes("/quota"))
    return {
      title: translate("Quota Tracker"),
      description: translate("Track and manage your API quota limits"),
      icon: "data_usage",
      breadcrumbs: [],
    };
  if (pathname.includes("/mitm"))
    return {
      title: translate("MITM Proxy"),
      description: translate("Intercept CLI tool traffic and route through NovaRoute"),
      icon: "security",
      breadcrumbs: [],
    };
  if (pathname.includes("/token-saver"))
    return {
      title: translate("Token Saver"),
      description: translate("Compress prompts and outputs to save tokens"),
      icon: "savings",
      breadcrumbs: [],
    };
  if (pathname.includes("/cli-tools"))
    return {
      title: translate("CLI Tools"),
      description: translate("Configure CLI tools"),
      icon: "terminal",
      breadcrumbs: [],
    };
  if (pathname.includes("/proxy-pools"))
    return {
      title: translate("Proxy Pools"),
      description: translate("Manage your proxy pool configurations"),
      icon: "lan",
      breadcrumbs: [],
    };
  if (pathname.includes("/skills"))
    return {
      title: translate("Agent Skills"),
      description: translate("Copy a link and paste to your AI to use NovaRoute — no install needed"),
      icon: "extension",
      breadcrumbs: [],
    };
  if (pathname.includes("/endpoint"))
    return {
      title: translate("Endpoint"),
      description: translate("API endpoint configuration"),
      icon: "api",
      breadcrumbs: [],
    };
  if (pathname.includes("/profile"))
    return {
      title: translate("Profile"),
      description: "Manage your preferences",
      icon: "settings",
      breadcrumbs: [],
    };
  if (pathname.includes("/translator"))
    return {
      title: translate("Translator"),
      description: translate("Debug translation flow between formats"),
      icon: "translate",
      breadcrumbs: [],
    };
  if (pathname.includes("/console-log"))
    return {
      title: translate("Console Log"),
      description: translate("Live server console output"),
      icon: "monitor",
      breadcrumbs: [],
    };
  if (pathname === "/dashboard")
    return {
      title: translate("Dashboard"),
      description: translate("Overview of your NovaRoute gateway"),
      icon: "dashboard",
      breadcrumbs: [],
    };
  return { title: "", description: "", breadcrumbs: [] };
};

export default function Header({ onMenuClick, showMenuButton = true }) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("");
  const [loginMethod, setLoginMethod] = useState("");
  const [donateOpen, setDonateOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const { theme, cycleTheme } = useTheme();
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const { query, setQuery } = useSidebarSearchStore();

  // Memoize page info to prevent unnecessary recalculations
  const pageInfo = useMemo(() => getPageInfo(pathname), [pathname]);
  const { title, description, icon, breadcrumbs } = pageInfo;

  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setDisplayName(data?.displayName || data?.oidcName || data?.oidcEmail || "");
          setLoginMethod(data?.loginMethod || "");
        }
      } catch {
        if (!cancelled) {
          setDisplayName("");
          setLoginMethod("");
        }
      }
    }

    loadAuthStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLocale(getCookieLocale());
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  const switchLang = async (code) => {
    if (code === locale) return;
    setLocale(code);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: code }),
      });
      await reloadTranslations();
    } catch { /* best-effort */ }
  };

  return (
    <header className="shrink-0 flex items-center justify-between gap-3 px-4 lg:px-8 h-[62px] border-b border-border-subtle bg-elevated z-20">
      {/* Mobile menu button */}
      <div className="flex items-center gap-3 lg:hidden shrink-0">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="flex items-center justify-center size-9 rounded-lg border border-border bg-surface/60 text-text-main hover:text-primary transition-colors"
            aria-label="Menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
      </div>

      {/* Page title with breadcrumbs */}
      <div className="flex flex-col min-w-0 flex-1">
        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-2">
            {breadcrumbs.map((crumb, index) => (
              <div
                key={`${crumb.label}-${crumb.href || "current"}`}
                className="flex items-center gap-2"
              >
                {index > 0 && (
                  <span className="material-symbols-outlined text-text-muted text-base">
                    chevron_right
                  </span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-text-muted hover:text-primary transition-colors text-sm"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    {crumb.image && (
                      <ProviderIcon
                        src={crumb.image}
                        alt={crumb.label}
                        size={26}
                        className="object-contain rounded max-w-[26px] max-h-[26px]"
                        fallbackText={crumb.label.slice(0, 2).toUpperCase()}
                      />
                    )}
                    <h1 className="text-[17px] lg:text-xl font-bold text-text-main tracking-tight truncate">
                      {translate(crumb.label)}
                    </h1>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : title ? (
          <div>
            <div className="flex items-center gap-2">
              {icon && (
                <span className="material-symbols-outlined text-primary text-[20px]">
                  {icon}
                </span>
              )}
              <h1 className="text-[17px] lg:text-xl font-bold tracking-tight truncate">
                {translate(title)}
              </h1>
            </div>
            {description && (
              <p className="hidden lg:block text-xs text-text-muted truncate mt-0.5">
                {translate(description)}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {displayName && loginMethod === "OIDC" && (
          <div className="hidden sm:flex items-center max-w-[220px] px-3 py-1.5 rounded-full border border-border bg-surface/70 text-xs text-text-muted truncate">
            <span className="material-symbols-outlined text-[14px] ms-1.5 text-primary">person</span>
            <span className="truncate">{displayName}</span>
            <span className="me-2 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              OIDC
            </span>
          </div>
        )}
        <HeaderSearch query={query} setQuery={setQuery} />
        <NotificationBell notifRef={notifRef} notifOpen={notifOpen} setNotifOpen={setNotifOpen} />
        <LanguageSwitcher locale={locale} onSwitch={switchLang} />
        <ThemeToggle theme={theme} onCycle={cycleTheme} />
        <button
          onClick={() => setDonateOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 transition-colors text-sm font-medium"
          aria-label="Donate"
        >
          <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
          <span className="hidden sm:inline">{translate("Donate")}</span>
        </button>
      </div>
      <DonateModal isOpen={donateOpen} onClose={() => setDonateOpen(false)} />
    </header>
  );
}

Header.propTypes = {
  onMenuClick: PropTypes.func,
  showMenuButton: PropTypes.bool,
};

function getCookieLocale() {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.split(";").find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  if (!match) return DEFAULT_LOCALE;
  const value = match.trim().slice(LOCALE_COOKIE.length + 1);
  return normalizeLocale(value);
}

function HeaderSearch({ query, setQuery }) {
  return (
    <div className="hidden md:flex items-center h-9 w-40 lg:w-56 rounded-lg border border-border bg-surface/70 px-2.5 gap-2 transition-colors focus-within:border-primary/50">
      <span className="material-symbols-outlined text-[18px] text-text-muted">search</span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={translate("Search")}
        aria-label={translate("Search")}
        className="w-full bg-transparent outline-none text-sm text-text-main placeholder:text-text-muted"
      />
      {query && (
        <button
          onClick={() => setQuery("")}
          className="text-text-muted hover:text-text-main transition-colors"
          aria-label="Clear search"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
}

function LanguageSwitcher({ locale, onSwitch }) {
  const langs = ["fa", "en", "ru"];
  return (
    <div className="hidden lg:flex items-center rounded-lg border border-border bg-surface/70 p-0.5">
      {langs.map((code) => (
        <button
          key={code}
          onClick={() => onSwitch(code)}
          className={`px-2 h-8 rounded-md text-xs font-medium uppercase transition-colors ${
            locale === code
              ? "bg-primary text-on-primary"
              : "text-text-muted hover:text-text-main"
          }`}
          aria-label={`Switch language to ${code}`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

function NotificationBell({ notifRef, notifOpen, setNotifOpen }) {
  const notifications = useNotificationStore((s) => s.notifications);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const count = notifications.length;
  const [shaking, setShaking] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 600);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  const TOAST_ICONS = { success: "check_circle", error: "error", warning: "warning", info: "info" };
  const TOAST_COLORS = {
    success: "text-emerald-500",
    error: "text-red-500",
    warning: "text-amber-500",
    info: "text-blue-500",
  };

  const formatTime = (ts) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return translate("just now");
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  return (
    <div className="relative" ref={notifRef}>
      <button
        onClick={() => setNotifOpen((p) => !p)}
        className="relative flex items-center justify-center size-9 rounded-lg border border-border bg-surface/70 text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
        aria-label={translate("Notifications")}
      >
        <span className={`material-symbols-outlined text-[20px] ${shaking ? "animate-shake" : ""}`}>notifications</span>
        {count > 0 && (
          <span className="absolute -top-1.5 -end-1.5 flex items-center justify-center size-5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-md">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {notifOpen && (
        <div className="absolute top-full end-0 mt-2 w-80 max-h-[70vh] flex flex-col rounded-2xl border border-border bg-elevated shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <h3 className="text-sm font-bold text-text-main">{translate("Notifications")}</h3>
            {count > 0 && (
              <button
                onClick={() => { clearAll(); setNotifOpen(false); }}
                className="text-xs text-text-muted hover:text-red-500 transition-colors"
              >
                {translate("Clear all")}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {count === 0 ? (
              <div className="py-10 text-center">
                <span className="material-symbols-outlined text-[32px] text-text-muted/40">notifications_off</span>
                <p className="mt-2 text-xs text-text-muted">{translate("No notifications")}</p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="group flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${TOAST_COLORS[n.type] || "text-text-muted"}`}>
                      {TOAST_ICONS[n.type] || "info"}
                    </span>
                    <div className="min-w-0 flex-1">
                      {n.title && <p className="text-xs font-semibold text-text-main mb-0.5">{n.title}</p>}
                      <p className="text-xs text-text-muted whitespace-pre-wrap break-words leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-text-muted/60 mt-1">{formatTime(n.createdAt)}</p>
                    </div>
                    {n.dismissible && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                        className="opacity-0 group-hover:opacity-100 shrink-0 text-text-muted hover:text-text-main transition-all"
                        aria-label="Dismiss"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Cycles dark -> light -> system so a stored "system" preference survives.
const THEME_MODES = {
  dark: { icon: "dark_mode", label: "Dark theme, switch to light" },
  light: { icon: "light_mode", label: "Light theme, switch to system" },
  system: { icon: "contrast", label: "System theme, switch to dark" },
};

function ThemeToggle({ theme, onCycle }) {
  const mode = THEME_MODES[theme] || THEME_MODES.dark;
  return (
    <button
      type="button"
      onClick={onCycle}
      className="flex items-center justify-center size-9 rounded-brand border border-border bg-surface text-text-muted hover:text-primary hover:bg-surface-2 transition-colors"
      aria-label={mode.label}
      title={mode.label}
    >
      <span className="material-symbols-outlined text-[18px]">{mode.icon}</span>
    </button>
  );
}
