"use client";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Input from "@/shared/components/Input";
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

export default function CacheSettingsPage() {
  const { settings, save } = useSettings();
  if (!settings) return null;

  const cache = settings.semanticCache || {};
  const updateCache = (patch) => save({ semanticCache: { ...cache, ...patch } });

  return (
    <div className="space-y-6">
      <Section title="Semantic Cache" description="Cache similar responses to reduce API calls and costs">
        <FieldRow label="Enable Semantic Cache">
          <Toggle
            checked={cache.enabled ?? false}
            onChange={(val) => updateCache({ enabled: val })}
          />
        </FieldRow>
        {cache.enabled && (
          <>
            <FieldRow
              label="Similarity Threshold"
              description="Minimum similarity score to serve from cache (0.0 - 1.0)"
            >
              <Input
                type="number"
                min={0.7}
                max={1.0}
                step={0.05}
                value={cache.threshold ?? 0.92}
                onChange={(e) => updateCache({ threshold: parseFloat(e.target.value) || 0.92 })}
                className="w-20 text-center"
              />
            </FieldRow>
            <FieldRow
              label="TTL (seconds)"
              description="How long cached entries stay valid"
            >
              <Input
                type="number"
                min={60}
                max={86400}
                value={cache.ttlSec ?? 3600}
                onChange={(e) => updateCache({ ttlSec: parseInt(e.target.value) || 3600 })}
                className="w-24 text-center"
              />
            </FieldRow>
            <FieldRow
              label="Max Entries"
              description="Maximum number of cached entries (oldest pruned first)"
            >
              <Input
                type="number"
                min={100}
                max={100000}
                value={cache.maxEntries ?? 10000}
                onChange={(e) => updateCache({ maxEntries: parseInt(e.target.value) || 10000 })}
                className="w-24 text-center"
              />
            </FieldRow>
            <FieldRow
              label="Cache Key"
              description="What determines cache uniqueness"
            >
              <Select
                options={[
                  { value: "prompt", label: "Prompt only" },
                  { value: "prompt+system", label: "Prompt + System message" },
                  { value: "prompt+model", label: "Prompt + Model" },
                ]}
                value={cache.keyStrategy || "prompt"}
                onChange={(e) => updateCache({ keyStrategy: e.target.value })}
              />
            </FieldRow>
          </>
        )}
      </Section>

      <Section title="Idempotency" description="Prevent duplicate requests from creating duplicate cache entries">
        <FieldRow label="Enable Idempotency Layer">
          <Toggle
            checked={cache.idempotency?.enabled ?? false}
            onChange={(val) =>
              updateCache({ idempotency: { ...(cache.idempotency || {}), enabled: val } })
            }
          />
        </FieldRow>
        {cache.idempotency?.enabled && (
          <FieldRow label="Dedup Window (seconds)">
            <Input
              type="number"
              min={5}
              max={300}
              value={cache.idempotency?.windowSec ?? 30}
              onChange={(e) =>
                updateCache({ idempotency: { ...(cache.idempotency || {}), windowSec: parseInt(e.target.value) || 30 } })
              }
              className="w-20 text-center"
            />
          </FieldRow>
        )}
      </Section>
    </div>
  );
}
