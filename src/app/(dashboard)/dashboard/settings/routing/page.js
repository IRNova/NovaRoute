"use client";
import { useState } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Select from "@/shared/components/Select";
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

const ROUTING_STRATEGIES = [
  { value: "fallback", label: "Fallback (default)" },
  { value: "round-robin", label: "Round Robin" },
  { value: "weighted", label: "Weighted" },
  { value: "cost-optimized", label: "Cost Optimized" },
  { value: "random", label: "Random" },
  { value: "auto", label: "Auto (smart)" },
];

const MODEL_ALIASES_PRESETS = [
  { value: "", label: "Custom" },
  { value: "claude", label: "Claude alias" },
  { value: "gpt", label: "GPT alias" },
  { value: "gemini", label: "Gemini alias" },
];

export default function RoutingSettingsPage() {
  const { settings, save } = useSettings();
  const [newAlias, setNewAlias] = useState({ alias: "", target: "" });

  if (!settings) return null;

  const routing = settings.routing || {};
  const aliases = settings.modelAliases || {};
  const thinkingBudget = settings.thinkingBudget || {};

  const updateRouting = (patch) => {
    save({ routing: { ...routing, ...patch } });
  };

  const addAlias = () => {
    if (!newAlias.alias || !newAlias.target) return;
    save({ modelAliases: { ...aliases, [newAlias.alias]: newAlias.target } });
    setNewAlias({ alias: "", target: "" });
  };

  const removeAlias = (key) => {
    const next = { ...aliases };
    delete next[key];
    save({ modelAliases: next });
  };

  return (
    <div className="space-y-6">
      <Section title="Routing Strategy" description="How NovaRoute selects models when using smart/auto routing">
        <FieldRow label="Default Strategy">
          <Select
            options={ROUTING_STRATEGIES}
            value={routing.defaultStrategy || "auto"}
            onChange={(e) => updateRouting({ defaultStrategy: e.target.value })}
          />
        </FieldRow>
        <FieldRow
          label="Max Candidates"
          description="Maximum number of models to try per request"
        >
          <Input
            type="number"
            min={1}
            max={20}
            value={routing.maxCandidates || 6}
            onChange={(e) => updateRouting({ maxCandidates: parseInt(e.target.value) || 6 })}
            className="w-20 text-center"
          />
        </FieldRow>
        <FieldRow
          label="Genius Mode"
          description="Quality-first selection with higher candidate count"
        >
          <Toggle
            checked={routing.geniusMode ?? false}
            onChange={(val) => updateRouting({ geniusMode: val })}
          />
        </FieldRow>
      </Section>

      <Section title="Combo Defaults" description="Default settings for model combo chains">
        <FieldRow
          label="Default Wait on Transient Error"
          description="Seconds to wait before trying the next model in a combo"
        >
          <Input
            type="number"
            min={0}
            max={30}
            value={routing.comboWaitSec ?? 5}
            onChange={(e) => updateRouting({ comboWaitSec: parseInt(e.target.value) || 5 })}
            className="w-20 text-center"
          />
        </FieldRow>
        <FieldRow
          label="Auto-Disable on Failure"
          description="Automatically disable a model after repeated failures"
        >
          <Toggle
            checked={routing.autoDisableOnFailure ?? false}
            onChange={(val) => updateRouting({ autoDisableOnFailure: val })}
          />
        </FieldRow>
        <FieldRow
          label="Failover Delay"
          description="Seconds before retrying a disabled model"
        >
          <Input
            type="number"
            min={60}
            max={86400}
            value={routing.failoverDelaySec ?? 300}
            onChange={(e) => updateRouting({ failoverDelaySec: parseInt(e.target.value) || 300 })}
            className="w-24 text-center"
          />
        </FieldRow>
      </Section>

      <Section title="Auto-Combo" description="Automatic model combo generation settings">
        <FieldRow
          label="Auto-Generate Combos"
          description="Automatically create combos based on your usage patterns"
        >
          <Toggle
            checked={routing.autoGenerateCombos ?? false}
            onChange={(val) => updateRouting({ autoGenerateCombos: val })}
          />
        </FieldRow>
        {routing.autoGenerateCombos && (
          <>
            <FieldRow
              label="Min Providers for Combo"
              description="Minimum active providers needed to auto-generate combos"
            >
              <Input
                type="number"
                min={2}
                max={10}
                value={routing.autoComboMinProviders ?? 2}
                onChange={(e) => updateRouting({ autoComboMinProviders: parseInt(e.target.value) || 2 })}
                className="w-20 text-center"
              />
            </FieldRow>
            <FieldRow
              label="Combo Size"
              description="Number of models per auto-generated combo"
            >
              <Input
                type="number"
                min={2}
                max={8}
                value={routing.autoComboSize ?? 3}
                onChange={(e) => updateRouting({ autoComboSize: parseInt(e.target.value) || 3 })}
                className="w-20 text-center"
              />
            </FieldRow>
          </>
        )}
      </Section>

      <Section title="Model Aliases" description="Map alias names to real provider/model pairs">
        <div className="space-y-2">
          {Object.entries(aliases).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <code className="px-2 py-1 bg-surface-3 rounded text-text-main font-mono text-xs">{key}</code>
              <span className="text-text-muted">→</span>
              <span className="text-text-main font-mono text-xs">{val}</span>
              <button
                onClick={() => removeAlias(key)}
                className="text-danger hover:text-danger/80 ms-auto text-xs"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Input
            placeholder="alias"
            value={newAlias.alias}
            onChange={(e) => setNewAlias({ ...newAlias, alias: e.target.value })}
            className="flex-1"
          />
          <Input
            placeholder="provider/model"
            value={newAlias.target}
            onChange={(e) => setNewAlias({ ...newAlias, target: e.target.value })}
            className="flex-1"
          />
          <Button size="sm" onClick={addAlias}>Add</Button>
        </div>
      </Section>

      <Section title="Thinking Budget" description="Control extended thinking token limits for capable models">
        <FieldRow
          label="Enable Thinking Budget"
          description="Set per-model token limits for extended thinking"
        >
          <Toggle
            checked={thinkingBudget.enabled ?? false}
            onChange={(val) => save({ thinkingBudget: { ...thinkingBudget, enabled: val } })}
          />
        </FieldRow>
        {thinkingBudget.enabled && (
          <FieldRow
            label="Default Budget"
            description="Default max thinking tokens (applies to all models unless overridden)"
          >
            <Input
              type="number"
              min={0}
              max={100000}
              value={thinkingBudget.defaultBudget ?? 10000}
              onChange={(e) =>
                save({ thinkingBudget: { ...thinkingBudget, defaultBudget: parseInt(e.target.value) || 10000 } })
              }
              className="w-28 text-center"
            />
          </FieldRow>
        )}
      </Section>
    </div>
  );
}
