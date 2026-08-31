"use client";

import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Button from "@/shared/components/Button";
import { useSettings } from "../SettingsShell";

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

const EVENTS = [
  ["gateway.autoban", "Auto-ban triggered"],
  ["providers.health", "Provider health failures"],
  ["pools.health", "Proxy pool failures"],
  ["backup.failed", "Backup failure"],
];

export default function NotificationsPage() {
  const { settings, save } = useSettings();
  const [testing, setTesting] = useState(false);

  if (!settings) return null;
  const cfg = settings.notifications || {};
  const update = (patch) => save({ notifications: { enabled: false, minSeverity: "warning", telegram: true, webhooks: true, ...cfg, ...patch } });

  const sendTest = async () => {
    setTesting(true);
    try {
      await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "notifications.test", payload: { message: "NovaRoute notifications test" } }),
      }).catch(() => {});
    } finally {
      setTesting(false);
    }
  };

  const enabled = cfg.enabled === true;

  return (
    <div className="space-y-6">
      <Section title="Event Notifications" description="Get alerted on auto-bans, failing providers/pools and backup problems.">
        <FieldRow label="Enable notifications" description="Master switch for all channels below. Rate-limited to one message per event type every 10 minutes.">
          <Toggle checked={enabled} onChange={(v) => update({ enabled: v })} />
        </FieldRow>
        <FieldRow label="Minimum severity" description="info = everything · warning = problems · error = critical only">
          <select
            className="px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-sm text-text-main"
            value={cfg.minSeverity || "warning"}
            onChange={(e) => update({ minSeverity: e.target.value })}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </FieldRow>
      </Section>

      <Section title="Channels" description="Where alerts are delivered when enabled above.">
        <FieldRow
          label="Telegram"
          description={<>Uses the admin bot configured under <b>Nova Bot → Telegram</b>. Delivered to your admin chat.</>}
        >
          <Toggle checked={cfg.telegram !== false} onChange={(v) => update({ telegram: v })} />
        </FieldRow>
        <FieldRow
          label="Webhooks"
          description={<>Fires to active webhooks subscribed to the matching events. Manage them on the <b>Webhooks</b> page.</>}
        >
          <Toggle checked={cfg.webhooks !== false} onChange={(v) => update({ webhooks: v })} />
        </FieldRow>
        <Button size="sm" variant="secondary" disabled={testing} onClick={sendTest}>
          {testing ? "Sending..." : "Send webhook test"}
        </Button>
      </Section>

      <Section title="Covered events" description="Event names you can subscribe to on webhooks.">
        <div className="space-y-1.5">
          {EVENTS.map(([name, desc]) => (
            <div key={name} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-surface-3/40 border border-border-subtle">
              <code dir="ltr" className="text-xs font-mono text-text-main">{name}</code>
              <span className="text-xs text-text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

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
