"use client";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Input from "@/shared/components/Input";
import Button from "@/shared/components/Button";
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

export default function AdvancedSettingsPage() {
  const { settings, save } = useSettings();
  if (!settings) return null;

  const advanced = settings.advanced || {};
  const update = (patch) => save({ advanced: { ...advanced, ...patch } });

  return (
    <div className="space-y-6">
      <Section title="Timeouts" description="Request and connection timeout values">
        <FieldRow
          label="Request Timeout (seconds)"
          description="Maximum time to wait for an upstream response"
        >
          <Input
            type="number"
            min={5}
            max={600}
            value={advanced.requestTimeoutSec ?? 120}
            onChange={(e) => update({ requestTimeoutSec: parseInt(e.target.value) || 120 })}
            className="w-24 text-center"
          />
        </FieldRow>
        <FieldRow
          label="Connect Timeout (seconds)"
          description="Maximum time to establish a connection to upstream"
        >
          <Input
            type="number"
            min={1}
            max={60}
            value={advanced.connectTimeoutSec ?? 10}
            onChange={(e) => update({ connectTimeoutSec: parseInt(e.target.value) || 10 })}
            className="w-24 text-center"
          />
        </FieldRow>
        <FieldRow
          label="Stream Timeout (seconds)"
          description="Maximum idle time between SSE chunks"
        >
          <Input
            type="number"
            min={5}
            max={300}
            value={advanced.streamTimeoutSec ?? 60}
            onChange={(e) => update({ streamTimeoutSec: parseInt(e.target.value) || 60 })}
            className="w-24 text-center"
          />
        </FieldRow>
      </Section>

      <Section title="Rate Limiting" description="Dashboard-side rate limiting">
        <FieldRow label="Enable Dashboard Rate Limiting">
          <Toggle
            checked={advanced.dashRateLimit?.enabled ?? false}
            onChange={(val) => update({ dashRateLimit: { ...(advanced.dashRateLimit || {}), enabled: val } })}
          />
        </FieldRow>
        {advanced.dashRateLimit?.enabled && (
          <FieldRow label="Max Requests per Minute">
            <Input
              type="number"
              min={1}
              max={10000}
              value={advanced.dashRateLimit?.rpm ?? 60}
              onChange={(e) =>
                update({ dashRateLimit: { ...(advanced.dashRateLimit || {}), rpm: parseInt(e.target.value) || 60 } })
              }
              className="w-24 text-center"
            />
          </FieldRow>
        )}
      </Section>

      <Section title="Cache Settings" description="Internal caching behavior">
        <FieldRow
          label="Provider Cache TTL (seconds)"
          description="How long to cache provider model lists"
        >
          <Input
            type="number"
            min={0}
            max={3600}
            value={advanced.providerCacheTtlSec ?? 300}
            onChange={(e) => update({ providerCacheTtlSec: parseInt(e.target.value) || 300 })}
            className="w-24 text-center"
          />
        </FieldRow>
        <FieldRow
          label="Capability Cache TTL (seconds)"
          description="How long to cache model capabilities"
        >
          <Input
            type="number"
            min={0}
            max={3600}
            value={advanced.capabilityCacheTtlSec ?? 600}
            onChange={(e) => update({ capabilityCacheTtlSec: parseInt(e.target.value) || 600 })}
            className="w-24 text-center"
          />
        </FieldRow>
      </Section>

      <Section title="Debug" description="Developer and debugging options">
        <FieldRow label="Verbose Logging">
          <Toggle
            checked={advanced.verboseLogging ?? false}
            onChange={(val) => update({ verboseLogging: val })}
          />
        </FieldRow>
        <FieldRow label="Log Request Bodies" description="Include full request bodies in logs">
          <Toggle
            checked={advanced.logRequestBodies ?? false}
            onChange={(val) => update({ logRequestBodies: val })}
          />
        </FieldRow>
        <FieldRow label="Log Response Headers" description="Include upstream response headers in logs">
          <Toggle
            checked={advanced.logResponseHeaders ?? false}
            onChange={(val) => update({ logResponseHeaders: val })}
          />
        </FieldRow>
      </Section>

      <Section title="Telemetry" description="Usage reporting and analytics">
        <FieldRow label="Enable Telemetry" description="Send anonymous usage data to improve NovaRoute">
          <Toggle
            checked={advanced.telemetry ?? true}
            onChange={(val) => update({ telemetry: val })}
          />
        </FieldRow>
        <FieldRow label="Error Reporting" description="Automatically report errors and crashes">
          <Toggle
            checked={advanced.errorReporting ?? true}
            onChange={(val) => update({ errorReporting: val })}
          />
        </FieldRow>
        <FieldRow label="Performance Metrics" description="Collect latency and throughput data">
          <Toggle
            checked={advanced.performanceMetrics ?? true}
            onChange={(val) => update({ performanceMetrics: val })}
          />
        </FieldRow>
        <FieldRow label="Usage Analytics" description="Track feature usage patterns">
          <Toggle
            checked={advanced.usageAnalytics ?? false}
            onChange={(val) => update({ usageAnalytics: val })}
          />
        </FieldRow>
      </Section>

      <Section title="Danger Zone" description="Irreversible or destructive operations">
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (confirm("Reset ALL settings to defaults? This cannot be undone.")) {
              save({});
              window.location.reload();
            }
          }}
        >
          Reset All Settings
        </Button>
      </Section>
    </div>
  );
}
