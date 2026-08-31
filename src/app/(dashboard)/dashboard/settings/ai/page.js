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

export default function AiSettingsPage() {
  const { settings, save } = useSettings();
  if (!settings) return null;

  const ai = settings.ai || {};
  const update = (patch) => save({ ai: { ...ai, ...patch } });

  return (
    <div className="space-y-6">
      <Section title="System Prompt" description="Default system prompt injected into all requests">
        <textarea
          value={ai.systemPrompt || ""}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          rows={6}
          className="w-full p-3 bg-surface-2 border border-surface-3 rounded-xl text-sm text-text-main resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
        />
      </Section>

      <Section title="Default Model" description="Fallback model when the client doesn't specify one">
        <Input
          placeholder="e.g. gpt-4o, claude-sonnet-4"
          value={ai.defaultModel || ""}
          onChange={(e) => update({ defaultModel: e.target.value })}
        />
      </Section>

      <Section title="Temperature & Sampling" description="Default sampling parameters">
        <FieldRow label="Default Temperature">
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={ai.defaultTemperature ?? 1.0}
            onChange={(e) => update({ defaultTemperature: parseFloat(e.target.value) || 1.0 })}
            className="w-20 text-center"
          />
        </FieldRow>
        <FieldRow label="Default Max Tokens">
          <Input
            type="number"
            min={1}
            max={1000000}
            value={ai.defaultMaxTokens ?? 4096}
            onChange={(e) => update({ defaultMaxTokens: parseInt(e.target.value) || 4096 })}
            className="w-28 text-center"
          />
        </FieldRow>
        <FieldRow label="Default Top P">
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={ai.defaultTopP ?? 1.0}
            onChange={(e) => update({ defaultTopP: parseFloat(e.target.value) || 1.0 })}
            className="w-20 text-center"
          />
        </FieldRow>
      </Section>

      <Section title="Extended Thinking" description="Configure extended thinking for capable models">
        <FieldRow label="Enable Thinking" description="Allow models to use extended thinking">
          <Toggle
            checked={ai.thinkingEnabled ?? false}
            onChange={(val) => update({ thinkingEnabled: val })}
          />
        </FieldRow>
        {ai.thinkingEnabled && (
          <FieldRow label="Thinking Budget (tokens)">
            <Input
              type="number"
              min={0}
              max={100000}
              value={ai.thinkingBudget ?? 10000}
              onChange={(e) => update({ thinkingBudget: parseInt(e.target.value) || 10000 })}
              className="w-28 text-center"
            />
          </FieldRow>
        )}
      </Section>

      <Section title="Safety" description="Content filtering and safety controls">
        <FieldRow label="Enable Content Filtering">
          <Toggle
            checked={ai.contentFilter ?? false}
            onChange={(val) => update({ contentFilter: val })}
          />
        </FieldRow>
        <FieldRow label="Max Request Size (bytes)" description="Reject requests larger than this">
          <Input
            type="number"
            min={1024}
            max={104857600}
            value={ai.maxRequestSize ?? 1048576}
            onChange={(e) => update({ maxRequestSize: parseInt(e.target.value) || 1048576 })}
            className="w-28 text-center"
          />
        </FieldRow>
      </Section>
    </div>
  );
}
