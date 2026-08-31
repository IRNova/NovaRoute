"use client";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Button from "@/shared/components/Button";
import { translate } from "@/i18n/runtime";
import { useSettings } from "../SettingsShell";

const SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", section: "Primary" },
  { id: "endpoint", label: "Endpoint", icon: "api", section: "Primary" },
  { id: "api-keys", label: "API Key", icon: "key", section: "Primary" },
  { id: "providers", label: "Providers", icon: "dns", section: "Primary" },
  { id: "combos", label: "Combos", icon: "layers", section: "Primary" },
  { id: "nova-bot", label: "Nova Bot", icon: "hub", section: "Primary" },
  { id: "usage", label: "Usage", icon: "bar_chart", section: "Consumption" },
  { id: "usage-analytics", label: "Analytics", icon: "query_stats", section: "Consumption" },
  { id: "costs", label: "Costs", icon: "payments", section: "Consumption" },
  { id: "provider-stats", label: "Provider Stats", icon: "monitoring", section: "Consumption" },
  { id: "cache", label: "Semantic Cache", icon: "database", section: "Consumption" },
  { id: "quota", label: "Quota Tracker", icon: "data_usage", section: "Consumption" },
  { id: "report", label: "Report", icon: "assessment", section: "Consumption" },
  { id: "token-saver", label: "Token Saver", icon: "savings", section: "Tools" },
  { id: "cli-tools", label: "CLI Tools", icon: "terminal", section: "Tools" },
  { id: "proxy-pools", label: "Proxy Pools", icon: "lan", section: "Tools" },
  { id: "skills", label: "Skills", icon: "extension", section: "Tools" },
  { id: "logs", label: "Request Logs", icon: "history", section: "More" },
  { id: "console-log", label: "Console Log", icon: "terminal", section: "More" },
  { id: "system", label: "System & Update", icon: "system_update", section: "More" },
];

export default function SidebarSettingsPage() {
  const { settings, save } = useSettings();

  if (!settings) return null;

  const sidebar = settings.sidebar || {};
  const pinnedItems = sidebar.pinnedItems || [];
  const itemOrder = sidebar.itemOrder || SIDEBAR_ITEMS.map((i) => i.id);

  const orderedItems = [...SIDEBAR_ITEMS].sort(
    (a, b) => itemOrder.indexOf(a.id) - itemOrder.indexOf(b.id)
  );

  const updateSidebar = (patch) => save({ sidebar: { ...sidebar, ...patch } });

  const togglePin = (id) => {
    const next = pinnedItems.includes(id)
      ? pinnedItems.filter((x) => x !== id)
      : [...pinnedItems, id];
    updateSidebar({ pinnedItems: next });
  };

  const moveItem = (id, direction) => {
    const idx = itemOrder.indexOf(id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= itemOrder.length) return;
    const next = [...itemOrder];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    updateSidebar({ itemOrder: next });
  };

  const resetOrder = () => {
    updateSidebar({ itemOrder: SIDEBAR_ITEMS.map((i) => i.id), pinnedItems: [] });
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text-main">Sidebar Customization</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Pin frequently used items and reorder the sidebar to match your workflow.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={resetOrder}>
            Reset
          </Button>
        </div>

        <div className="space-y-2">
          {orderedItems.map((item, index) => {
            const isPinned = pinnedItems.includes(item.id);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-xl bg-surface-2/40 border border-surface-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[18px] text-text-muted">
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-main">{translate(item.label)}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wide">{translate(item.section)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveItem(item.id, "up")}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-text-muted hover:bg-surface-3 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(item.id, "down")}
                      disabled={index === orderedItems.length - 1}
                      className="p-1.5 rounded-lg text-text-muted hover:bg-surface-3 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                    </button>
                  </div>
                  <Toggle
                    checked={isPinned}
                    onChange={() => togglePin(item.id)}
                    aria-label="Pin item"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
