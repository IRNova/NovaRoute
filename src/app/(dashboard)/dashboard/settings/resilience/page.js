"use client";
import { useState } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";
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

function AddProviderOverride({ onAdd, existing = [] }) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState("");
  const PROVIDERS = ["openai", "anthropic", "google", "mistral", "openrouter", "xai", "deepseek", "groq", "together", "fireworks"];
  const available = PROVIDERS.filter((p) => !existing.includes(p));
  return open ? (
    <div className="flex items-center gap-2">
      <Select
        options={available.map((p) => ({ value: p, label: p }))}
        value={providerId}
        onChange={(e) => setProviderId(e.target.value)}
      />
      <Button size="sm" onClick={() => { if (providerId) { onAdd(providerId); setProviderId(""); setOpen(false); } }}>Add</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>+ Add Provider Override</Button>
  );
}

export default function ResilienceSettingsPage() {
  const { settings, save } = useSettings();
  if (!settings) return null;

  const resilience = settings.resilience || {};
  const update = (patch) => save({ resilience: { ...resilience, ...patch } });

  return (
    <div className="space-y-6">
      <Section title="Circuit Breaker" description="Temporarily disable providers after consecutive failures">
        <FieldRow label="Enable Circuit Breaker">
          <Toggle
            checked={resilience.circuitBreaker?.enabled ?? false}
            onChange={(val) => update({ circuitBreaker: { ...(resilience.circuitBreaker || {}), enabled: val } })}
          />
        </FieldRow>
        <FieldRow
          label="Failure Threshold"
          description="Number of consecutive failures before tripping the breaker"
        >
          <Input
            type="number"
            min={1}
            max={100}
            value={resilience.circuitBreaker?.failureThreshold ?? 5}
            onChange={(e) =>
              update({ circuitBreaker: { ...(resilience.circuitBreaker || {}), failureThreshold: parseInt(e.target.value) || 5 } })
            }
            className="w-20 text-center"
          />
        </FieldRow>
        <FieldRow
          label="Cooldown (seconds)"
          description="How long to keep the breaker tripped before retrying"
        >
          <Input
            type="number"
            min={30}
            max={3600}
            value={resilience.circuitBreaker?.cooldownSec ?? 300}
            onChange={(e) =>
              update({ circuitBreaker: { ...(resilience.circuitBreaker || {}), cooldownSec: parseInt(e.target.value) || 300 } })
            }
            className="w-24 text-center"
          />
        </FieldRow>
      </Section>

      <Section title="Connection Cooldown" description="Delay between retries on the same connection">
        <FieldRow
          label="Cooldown (seconds)"
          description="Wait time before retrying a failed connection"
        >
          <Input
            type="number"
            min={0}
            max={120}
            value={resilience.connectionCooldownSec ?? 5}
            onChange={(e) => update({ connectionCooldownSec: parseInt(e.target.value) || 5 })}
            className="w-20 text-center"
          />
        </FieldRow>
      </Section>

      <Section title="Request Queue" description="Queue requests when all providers are at capacity">
        <FieldRow label="Enable Request Queue">
          <Toggle
            checked={resilience.requestQueue?.enabled ?? false}
            onChange={(val) => update({ requestQueue: { ...(resilience.requestQueue || {}), enabled: val } })}
          />
        </FieldRow>
        {resilience.requestQueue?.enabled && (
          <>
            <FieldRow label="Max Queue Size">
              <Input
                type="number"
                min={1}
                max={1000}
                value={resilience.requestQueue?.maxSize ?? 50}
                onChange={(e) =>
                  update({ requestQueue: { ...(resilience.requestQueue || {}), maxSize: parseInt(e.target.value) || 50 } })
                }
                className="w-20 text-center"
              />
            </FieldRow>
            <FieldRow label="Queue Timeout (seconds)">
              <Input
                type="number"
                min={1}
                max={300}
                value={resilience.requestQueue?.timeoutSec ?? 30}
                onChange={(e) =>
                  update({ requestQueue: { ...(resilience.requestQueue || {}), timeoutSec: parseInt(e.target.value) || 30 } })
                }
                className="w-20 text-center"
              />
            </FieldRow>
          </>
        )}
      </Section>

      <Section title="Auto-Disable" description="Automatically disable models or providers after failures">
        <FieldRow label="Enable Auto-Disable">
          <Toggle
            checked={resilience.autoDisable?.enabled ?? false}
            onChange={(val) => update({ autoDisable: { ...(resilience.autoDisable || {}), enabled: val } })}
          />
        </FieldRow>
        {resilience.autoDisable?.enabled && (
          <>
            <FieldRow label="Failure Count to Disable">
              <Input
                type="number"
                min={1}
                max={100}
                value={resilience.autoDisable?.failureCount ?? 10}
                onChange={(e) =>
                  update({ autoDisable: { ...(resilience.autoDisable || {}), failureCount: parseInt(e.target.value) || 10 } })
                }
                className="w-20 text-center"
              />
            </FieldRow>
            <FieldRow label="Disable Duration (seconds)">
              <Input
                type="number"
                min={60}
                max={86400}
                value={resilience.autoDisable?.durationSec ?? 600}
                onChange={(e) =>
                  update({ autoDisable: { ...(resilience.autoDisable || {}), durationSec: parseInt(e.target.value) || 600 } })
                }
                className="w-24 text-center"
              />
            </FieldRow>
          </>
        )}
      </Section>

      <Section title="Model Lockout" description="Lock specific models after repeated failures">
        <FieldRow label="Enable Model Lockout">
          <Toggle
            checked={resilience.modelLockout?.enabled ?? false}
            onChange={(val) => update({ modelLockout: { ...(resilience.modelLockout || {}), enabled: val } })}
          />
        </FieldRow>
        {resilience.modelLockout?.enabled && (
          <FieldRow label="Lockout Duration (seconds)">
            <Input
              type="number"
              min={60}
              max={86400}
              value={resilience.modelLockout?.durationSec ?? 900}
              onChange={(e) =>
                update({ modelLockout: { ...(resilience.modelLockout || {}), durationSec: parseInt(e.target.value) || 900 } })
              }
              className="w-24 text-center"
            />
          </FieldRow>
        )}
      </Section>

      <Section title="Per-Provider Circuit Breaker" description="Override circuit breaker settings for specific providers">
        {Object.entries(resilience.providerOverrides || {}).map(([providerId, override]) => (
          <div key={providerId} className="p-3 rounded-xl bg-surface-3/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-main">{providerId}</span>
              <button
                onClick={() => {
                  const next = { ...(resilience.providerOverrides || {}) };
                  delete next[providerId];
                  update({ providerOverrides: next });
                }}
                className="text-text-muted hover:text-danger"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-text-muted">Failure Threshold</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={override.failureThreshold ?? 5}
                  onChange={(e) => {
                    const next = { ...(resilience.providerOverrides || {}), [providerId]: { ...override, failureThreshold: parseInt(e.target.value) || 5 } };
                    update({ providerOverrides: next });
                  }}
                  className="w-full text-center"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted">Cooldown (s)</label>
                <Input
                  type="number"
                  min={30}
                  max={3600}
                  value={override.cooldownSec ?? 300}
                  onChange={(e) => {
                    const next = { ...(resilience.providerOverrides || {}), [providerId]: { ...override, cooldownSec: parseInt(e.target.value) || 300 } };
                    update({ providerOverrides: next });
                  }}
                  className="w-full text-center"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted">Enabled</label>
                <Toggle
                  checked={override.enabled ?? true}
                  onChange={(val) => {
                    const next = { ...(resilience.providerOverrides || {}), [providerId]: { ...override, enabled: val } };
                    update({ providerOverrides: next });
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        <AddProviderOverride onAdd={(id) => {
          const next = { ...(resilience.providerOverrides || {}), [id]: { enabled: true, failureThreshold: 5, cooldownSec: 300 } };
          update({ providerOverrides: next });
        }} existing={Object.keys(resilience.providerOverrides || {})} />
      </Section>

      <Section title="Rate Limits" description="Per-model or per-provider rate limiting">
        <FieldRow label="Enable Rate Limits">
          <Toggle
            checked={resilience.rateLimits?.enabled ?? false}
            onChange={(val) => update({ rateLimits: { ...(resilience.rateLimits || {}), enabled: val } })}
          />
        </FieldRow>
        {resilience.rateLimits?.enabled && (
          <FieldRow label="Default RPM Limit">
            <Input
              type="number"
              min={1}
              max={10000}
              value={resilience.rateLimits?.defaultRpm ?? 60}
              onChange={(e) =>
                update({ rateLimits: { ...(resilience.rateLimits || {}), defaultRpm: parseInt(e.target.value) || 60 } })
              }
              className="w-24 text-center"
            />
          </FieldRow>
        )}
      </Section>
    </div>
  );
}
