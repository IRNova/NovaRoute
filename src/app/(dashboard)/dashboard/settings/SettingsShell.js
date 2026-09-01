"use client";
import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CardSkeleton } from "@/shared/components/Loading";

const TABS = [
  { label: "General", value: "general", icon: "settings" },
  { label: "Routing", value: "routing", icon: "route" },
  { label: "Cache", value: "cache", icon: "database" },
  { label: "Security", value: "security", icon: "shield" },
  { label: "Notifications", value: "notifications", icon: "notifications" },
  { label: "Resilience", value: "resilience", icon: "shield_lock" },
  { label: "Feature Flags", value: "feature-flags", icon: "flag" },
  { label: "Modality Bridge", value: "modality-bridge", icon: "compare_arrows" },
  { label: "Pricing", value: "pricing", icon: "payments" },
  { label: "Sidebar", value: "sidebar", icon: "view_sidebar" },
  { label: "Appearance", value: "appearance", icon: "palette" },
  { label: "AI", value: "ai", icon: "psychology" },
  { label: "Advanced", value: "advanced", icon: "tune" },
  // Was not in this list at all, so the page holding the update button could
  // only be reached by typing its URL.
  { label: "System & Update", value: "system", icon: "system_update" },
];

export const SettingsContext = createContext(null);

export function useSettings() {
  return useContext(SettingsContext);
}

export default function SettingsShell({ children }) {
  const pathname = usePathname();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (cancelled) return;
        setSettings(await res.json());
      } catch {
        setSettings({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (patch) => {
    const next = { ...(settings || {}), ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await fetch("/api/settings", { method: "PATCH", body: JSON.stringify(next) });
    } catch {
      // fail-open
    } finally {
      setSaving(false);
    }
  };

  const activeTab = pathname.split("/settings/")[1] || "general";

  if (loading) {
    return (
      <div className="p-6">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <SettingsContext.Provider value={{ settings, save, saving }}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-main">Settings</h1>
          {saving && (
            <span className="text-xs text-primary animate-pulse font-medium">Saving...</span>
          )}
        </div>

        <div className="flex gap-6">
          <nav className="w-52 shrink-0 space-y-1">
            {TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/dashboard/settings/${tab.value}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1 min-w-0 space-y-6">{children}</div>
        </div>
      </div>
    </SettingsContext.Provider>
  );
}
