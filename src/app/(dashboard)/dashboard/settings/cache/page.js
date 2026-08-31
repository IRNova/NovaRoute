"use client";
import { useState } from "react";
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
  const [showQdrantKey, setShowQdrantKey] = useState(false);

  if (!settings) return null;

  const semantic = settings.semanticCache || {};
  const updateSemantic = (patch) => save({ semanticCache: { ...semantic, ...patch } });

  const memory = settings.memoryCache || {};
  const updateMemory = (patch) => save({ memoryCache: { ...memory, ...patch } });

  const qdrant = settings.qdrant || {};
  const updateQdrant = (patch) => save({ qdrant: { ...qdrant, ...patch } });

  const catalogTtl = settings.modelCatalogCacheTtlSec ?? 300;

  return (
    <div className="space-y-6">
      <Section title="Semantic Cache" description="Cache similar responses to reduce API calls and costs">
        <FieldRow label="Enable Semantic Cache">
          <Toggle
            checked={semantic.enabled ?? false}
            onChange={(val) => updateSemantic({ enabled: val })}
          />
        </FieldRow>
        {semantic.enabled && (
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
                value={semantic.threshold ?? 0.92}
                onChange={(e) => updateSemantic({ threshold: parseFloat(e.target.value) || 0.92 })}
                className="w-20 text-center"
              />
            </FieldRow>
            <FieldRow label="TTL (seconds)" description="How long cached entries stay valid">
              <Input
                type="number"
                min={60}
                max={86400}
                value={semantic.ttlSec ?? 3600}
                onChange={(e) => updateSemantic({ ttlSec: parseInt(e.target.value) || 3600 })}
                className="w-24 text-center"
              />
            </FieldRow>
            <FieldRow label="Max Entries" description="Maximum number of cached entries">
              <Input
                type="number"
                min={100}
                max={100000}
                value={semantic.maxEntries ?? 10000}
                onChange={(e) => updateSemantic({ maxEntries: parseInt(e.target.value) || 10000 })}
                className="w-24 text-center"
              />
            </FieldRow>
            <FieldRow label="Cache Key" description="What determines cache uniqueness">
              <Select
                options={[
                  { value: "prompt", label: "Prompt only" },
                  { value: "prompt+system", label: "Prompt + System message" },
                  { value: "prompt+model", label: "Prompt + Model" },
                ]}
                value={semantic.keyStrategy || "prompt"}
                onChange={(e) => updateSemantic({ keyStrategy: e.target.value })}
              />
            </FieldRow>
          </>
        )}
      </Section>

      <Section title="Memory Cache" description="Fast in-memory cache for frequently accessed data">
        <FieldRow label="Enable Memory Cache">
          <Toggle
            checked={memory.enabled ?? false}
            onChange={(val) => updateMemory({ enabled: val })}
          />
        </FieldRow>
        {memory.enabled && (
          <>
            <FieldRow label="Max Items" description="Maximum entries kept in memory">
              <Input
                type="number"
                min={10}
                max={100000}
                value={memory.maxItems ?? 1000}
                onChange={(e) => updateMemory({ maxItems: parseInt(e.target.value) || 1000 })}
                className="w-24 text-center"
              />
            </FieldRow>
            <FieldRow label="TTL (seconds)" description="How long memory entries stay valid">
              <Input
                type="number"
                min={5}
                max={3600}
                value={memory.ttlSec ?? 60}
                onChange={(e) => updateMemory({ ttlSec: parseInt(e.target.value) || 60 })}
                className="w-20 text-center"
              />
            </FieldRow>
          </>
        )}
      </Section>

      <Section title="Qdrant Vector Store" description="External vector database for semantic cache">
        <FieldRow label="Enable Qdrant">
          <Toggle
            checked={qdrant.enabled ?? false}
            onChange={(val) => updateQdrant({ enabled: val })}
          />
        </FieldRow>
        {qdrant.enabled && (
          <div className="space-y-3">
            <Input
              label="Qdrant URL"
              placeholder="http://localhost:6333"
              value={qdrant.url || ""}
              onChange={(e) => updateQdrant({ url: e.target.value })}
            />
            <Input
              label="Collection"
              placeholder="semantic-cache"
              value={qdrant.collection || ""}
              onChange={(e) => updateQdrant({ collection: e.target.value })}
            />
            <div className="relative">
              <Input
                label="API Key"
                type={showQdrantKey ? "text" : "password"}
                placeholder="Optional"
                value={qdrant.apiKey || ""}
                onChange={(e) => updateQdrant({ apiKey: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowQdrantKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-3 text-xs text-text-muted hover:text-text-main"
              >
                {showQdrantKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Model Catalog Cache" description="How long provider model catalogs are cached">
        <FieldRow label="Catalog TTL (seconds)">
          <Input
            type="number"
            min={10}
            max={3600}
            value={catalogTtl}
            onChange={(e) => save({ modelCatalogCacheTtlSec: parseInt(e.target.value) || 300 })}
            className="w-24 text-center"
          />
        </FieldRow>
      </Section>
    </div>
  );
}
