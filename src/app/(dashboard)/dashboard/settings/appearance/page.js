"use client";
import { useEffect, useMemo } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Select from "@/shared/components/Select";
import { useSettings } from "../SettingsShell";

function Section({ title, description, children }) {
  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-main">{title}</h3>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function FieldRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-main">{label}</p>
        {description && <p className="text-xs text-text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const ACCENT_COLORS = [
  { value: "#4f8cff", label: "Blue" },
  { value: "#34d399", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f472b6", label: "Pink" },
  { value: "#a78bfa", label: "Purple" },
  { value: "#22d3ee", label: "Cyan" },
  { value: "#fb7185", label: "Rose" },
  { value: "#84cc16", label: "Lime" },
];

const FONTS = [
  { value: "inter", label: "Inter", family: "'Inter', sans-serif" },
  { value: "system", label: "System Default", family: "system-ui, sans-serif" },
  { value: "jetbrains", label: "JetBrains Mono", family: "'JetBrains Mono', monospace" },
  { value: "fira", label: "Fira Code", family: "'Fira Code', monospace" },
  { value: "roboto", label: "Roboto", family: "'Roboto', sans-serif" },
  { value: "poppins", label: "Poppins", family: "'Poppins', sans-serif" },
];

const FONT_SIZES = { xs: "12px", sm: "13px", base: "14px", lg: "15px", xl: "16px" };

function applyFontVars(appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const fontDef = FONTS.find((f) => f.value === (appearance.font || "inter"));
  const monoDef = FONTS.find((f) => f.value === (appearance.monoFont || "jetbrains"));
  if (fontDef) root.style.setProperty("--font-ui", fontDef.family);
  if (monoDef) root.style.setProperty("--font-mono", monoDef.family);
  const size = FONT_SIZES[appearance.fontSize] || "14px";
  root.style.setProperty("--font-size-base", size);
  if (appearance.accentColor) root.style.setProperty("--color-primary", appearance.accentColor);
}

export default function AppearanceSettingsPage() {
  const { settings, save } = useSettings();
  const appearance = useMemo(() => settings?.appearance || {}, [settings?.appearance]);

  useEffect(() => {
    if (settings) applyFontVars(appearance);
  }, [settings, appearance]);

  if (!settings) return null;

  const update = (patch) => {
    save({ appearance: { ...appearance, ...patch } });
    applyFontVars({ ...appearance, ...patch });
  };

  return (
    <div className="space-y-6">
      <Section title="Theme" description="Visual theme for the dashboard">
        <FieldRow label="Theme">
          <Select
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ]}
            value={appearance.theme || "dark"}
            onChange={(e) => update({ theme: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Accent Color">
          <div className="flex gap-2">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => update({ accentColor: c.value })}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  (appearance.accentColor || "#4f8cff") === c.value
                    ? "border-white scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </FieldRow>
      </Section>

      <Section title="Typography" description="Font settings for the dashboard">
        <FieldRow label="UI Font" description="Main font for interface elements">
          <Select
            options={FONTS.map((f) => ({ value: f.value, label: f.label }))}
            value={appearance.font || "inter"}
            onChange={(e) => update({ font: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Font Size" description="Base font size for text">
          <Select
            options={[
              { value: "xs", label: "Extra Small (12px)" },
              { value: "sm", label: "Small (13px)" },
              { value: "base", label: "Default (14px)" },
              { value: "lg", label: "Large (15px)" },
              { value: "xl", label: "Extra Large (16px)" },
            ]}
            value={appearance.fontSize || "base"}
            onChange={(e) => update({ fontSize: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Monospace Font" description="Font for code blocks and terminal output">
          <Select
            options={[
              { value: "jetbrains", label: "JetBrains Mono" },
              { value: "fira", label: "Fira Code" },
              { value: "system", label: "System Monospace" },
            ]}
            value={appearance.monoFont || "jetbrains"}
            onChange={(e) => update({ monoFont: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Compact Mode" description="Reduce spacing for denser layout">
          <Toggle
            checked={appearance.compactMode ?? false}
            onChange={(val) => update({ compactMode: val })}
          />
        </FieldRow>
      </Section>

      <Section title="Layout" description="Dashboard layout options">
        <FieldRow label="Home Page" description="Default page after login">
          <Select
            options={[
              { value: "/dashboard/usage", label: "Usage Overview" },
              { value: "/dashboard/providers", label: "Providers" },
              { value: "/dashboard/endpoint", label: "Endpoint" },
            ]}
            value={appearance.homePage || "/dashboard/usage"}
            onChange={(e) => update({ homePage: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Show Tunnel in Sidebar" description="Show/hide the tunnel status in sidebar">
          <Toggle
            checked={appearance.showTunnel ?? true}
            onChange={(val) => update({ showTunnel: val })}
          />
        </FieldRow>
        <FieldRow label="Combo Config Mode" description="Simple or advanced combo configuration">
          <Select
            options={[
              { value: "simple", label: "Simple" },
              { value: "advanced", label: "Advanced" },
            ]}
            value={appearance.comboConfigMode || "simple"}
            onChange={(e) => update({ comboConfigMode: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Auto-Refresh Quota" description="Automatically refresh quota status">
          <Toggle
            checked={appearance.autoRefreshQuota ?? true}
            onChange={(val) => update({ autoRefreshQuota: val })}
          />
        </FieldRow>
        <FieldRow label="Show Email in Profile" description="Display email address in profile page">
          <Toggle
            checked={appearance.showEmail ?? false}
            onChange={(val) => update({ showEmail: val })}
          />
        </FieldRow>
      </Section>
    </div>
  );
}
