"use client";

import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";
import useSettingsSection from "./useSettingsSection";
import SectionRow from "./SectionRow";
import SaveBar from "./SaveBar";
import { cn } from "@/shared/utils/cn";

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-medium text-sm sm:text-base">{label}</label>
      {children}
      {hint && <p className="text-xs sm:text-sm text-text-muted">{hint}</p>}
    </div>
  );
}

const num = (value, fallback) => (value === "" || value == null ? fallback : Number(value));
const clamp = (value, min, max, fallback) =>
  Math.min(max, Math.max(min, num(value, fallback)));

const EMBEDDING_PROVIDERS = [
  { value: "ollama", label: "Ollama" },
  { value: "lm-studio", label: "LM Studio" },
  { value: "llamacpp", label: "llama.cpp" },
  { value: "kobold", label: "Kobold" },
  { value: "local", label: "Other local" },
];

const RUNTIMES = [
  { value: "ollama", label: "Ollama" },
  { value: "lm-studio", label: "LM Studio" },
  { value: "llamacpp", label: "llama.cpp" },
];

function SemanticCacheCard() {
  const { form, setField, save, loading, saving, status } = useSettingsSection(
    (settings) => ({
      enabled: settings?.semanticCache?.enabled === true,
      embeddingProvider: settings?.semanticCache?.embeddingProvider || "ollama",
      embeddingModel: settings?.semanticCache?.embeddingModel || "nomic-embed-text",
      ollamaBaseUrl: settings?.semanticCache?.ollamaBaseUrl || "http://localhost:11434",
      threshold: settings?.semanticCache?.threshold ?? 0.85,
      ttlHours: settings?.semanticCache?.ttlHours ?? 72,
      maxEntries: settings?.semanticCache?.maxEntries ?? 5000,
      maxResponseBytes: settings?.semanticCache?.maxResponseBytes ?? 1000000,
      lookupTimeoutMs: settings?.semanticCache?.lookupTimeoutMs ?? 3000,
      embeddingTimeoutMs: settings?.semanticCache?.embeddingTimeoutMs ?? 10000,
    }),
  );

  const handleSave = () => {
    const threshold = clamp(form.threshold, 0.5, 1, 0.85);
    save(
      {
        semanticCache: {
          enabled: form.enabled,
          embeddingProvider: form.embeddingProvider,
          embeddingModel: form.embeddingModel || "nomic-embed-text",
          ollamaBaseUrl: form.ollamaBaseUrl || "http://localhost:11434",
          threshold,
          ttlHours: clamp(form.ttlHours, 1, 8760, 72),
          maxEntries: clamp(form.maxEntries, 10, 100000, 5000),
          maxResponseBytes: clamp(form.maxResponseBytes, 1000, 100000000, 1000000),
          lookupTimeoutMs: clamp(form.lookupTimeoutMs, 50, 30000, 3000),
          embeddingTimeoutMs: clamp(form.embeddingTimeoutMs, 50, 60000, 10000),
        },
      },
      "Semantic cache saved",
    );
  };

  return (
    <Card
      title="Semantic Cache"
      subtitle="Serve near-identical requests from a local embedding index"
      icon="cached"
    >
      <div className="flex flex-col gap-4">
        <SectionRow
          title="Enable semantic cache"
          description="Store and reuse responses for semantically similar prompts."
          checked={form.enabled}
          onChange={(value) => setField("enabled", value)}
          disabled={loading}
        />
        {form.enabled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <Field label="Embedding provider">
                <Select
                  options={EMBEDDING_PROVIDERS}
                  value={form.embeddingProvider}
                  onChange={(e) => setField("embeddingProvider", e.target.value)}
                  disabled={loading}
                  aria-label="Embedding provider"
                />
              </Field>
              <Field label="Embedding model">
                <Input
                  value={form.embeddingModel}
                  onChange={(e) => setField("embeddingModel", e.target.value)}
                  disabled={loading}
                  placeholder="nomic-embed-text"
                  aria-label="Embedding model"
                />
              </Field>
            </div>
            {form.embeddingProvider === "ollama" && (
              <Field label="Ollama base URL">
                <Input
                  value={form.ollamaBaseUrl}
                  onChange={(e) => setField("ollamaBaseUrl", e.target.value)}
                  disabled={loading}
                  placeholder="http://localhost:11434"
                  aria-label="Ollama base URL"
                />
              </Field>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Similarity threshold" hint="0.5 - 1.0 (higher = stricter match)">
                <Input
                  type="number"
                  min="0.5"
                  max="1"
                  step="0.01"
                  value={form.threshold}
                  onChange={(e) => setField("threshold", e.target.value)}
                  disabled={loading}
                  aria-label="Similarity threshold"
                />
              </Field>
              <Field label="TTL (hours)">
                <Input
                  type="number"
                  min="1"
                  max="8760"
                  value={form.ttlHours}
                  onChange={(e) => setField("ttlHours", e.target.value)}
                  disabled={loading}
                  aria-label="Cache TTL in hours"
                />
              </Field>
              <Field label="Max entries">
                <Input
                  type="number"
                  min="10"
                  max="100000"
                  value={form.maxEntries}
                  onChange={(e) => setField("maxEntries", e.target.value)}
                  disabled={loading}
                  aria-label="Maximum cache entries"
                />
              </Field>
            </div>
          </>
        )}
        <SaveBar onSave={handleSave} saving={saving} status={status} disabled={loading} saveLabel="Save cache settings" />
      </div>
    </Card>
  );
}

function SemanticCompressCard() {
  const { form, setField, save, loading, saving, status } = useSettingsSection(
    (settings) => ({
      enabled: settings?.semanticCompressEnabled === true,
      url: settings?.semanticCompressUrl || "http://localhost:20128/v1/chat/completions",
      model: settings?.semanticCompressModel || "gpt-5-mini",
      minChars: settings?.semanticCompressMinChars ?? 120000,
      timeoutMs: settings?.semanticCompressTimeoutMs ?? 12000,
    }),
  );

  const handleSave = () => {
    save(
      {
        semanticCompressEnabled: form.enabled,
        semanticCompressUrl: form.url || "http://localhost:20128/v1/chat/completions",
        semanticCompressModel: form.model || "gpt-5-mini",
        semanticCompressMinChars: clamp(form.minChars, 1000, 10000000, 120000),
        semanticCompressTimeoutMs: clamp(form.timeoutMs, 1000, 120000, 12000),
      },
      "Semantic compression saved",
    );
  };

  return (
    <Card
      title="Semantic Compression"
      subtitle="Summarize oversized context with an LLM before routing"
      icon="compress"
    >
      <div className="flex flex-col gap-4">
        <SectionRow
          title="Enable semantic compression"
          description="When a request exceeds the minimum length, condense it first."
          checked={form.enabled}
          onChange={(value) => setField("enabled", value)}
          disabled={loading}
        />
        {form.enabled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <Field label="LLM endpoint">
                <Input
                  value={form.url}
                  onChange={(e) => setField("url", e.target.value)}
                  disabled={loading}
                  aria-label="Compression LLM endpoint"
                />
              </Field>
              <Field label="Model">
                <Input
                  value={form.model}
                  onChange={(e) => setField("model", e.target.value)}
                  disabled={loading}
                  aria-label="Compression model"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Min chars" hint="Only compress messages above this size">
                <Input
                  type="number"
                  min="1000"
                  max="10000000"
                  value={form.minChars}
                  onChange={(e) => setField("minChars", e.target.value)}
                  disabled={loading}
                  aria-label="Minimum characters to compress"
                />
              </Field>
              <Field label="Timeout (ms)">
                <Input
                  type="number"
                  min="1000"
                  max="120000"
                  value={form.timeoutMs}
                  onChange={(e) => setField("timeoutMs", e.target.value)}
                  disabled={loading}
                  aria-label="Compression timeout in milliseconds"
                />
              </Field>
            </div>
          </>
        )}
        <SaveBar onSave={handleSave} saving={saving} status={status} disabled={loading} saveLabel="Save compression settings" />
      </div>
    </Card>
  );
}

function LocalFirstCard() {
  const { form, setField, setForm, save, loading, saving, status } = useSettingsSection(
    (settings) => ({
      enabled: settings?.localFirst?.enabled === true,
      runtimes: settings?.localFirst?.runtimes || ["ollama", "lm-studio", "llamacpp"],
      runtimeUrls: settings?.localFirst?.runtimeUrls || {},
      preferForTasks: settings?.localFirst?.preferForTasks || ["simple", "explanation", "refactor", "debug"],
      fallbackIfLocalFail: settings?.localFirst?.fallbackIfLocalFail !== false,
      probeTimeoutMs: settings?.localFirst?.probeTimeoutMs ?? 1500,
    }),
  );

  const toggleRuntime = (value) => {
    const runtimes = form.runtimes.includes(value)
      ? form.runtimes.filter((r) => r !== value)
      : [...form.runtimes, value];
    setForm((prev) => ({ ...prev, runtimes }));
  };

  const handleSave = () => {
    save(
      {
        localFirst: {
          enabled: form.enabled,
          runtimes: form.runtimes,
          runtimeUrls: form.runtimeUrls || {},
          preferForTasks: form.preferForTasks || [],
          fallbackIfLocalFail: form.fallbackIfLocalFail,
          probeTimeoutMs: clamp(form.probeTimeoutMs, 100, 30000, 1500),
        },
      },
      "Local-first saved",
    );
  };

  return (
    <Card
      title="Local-First Routing"
      subtitle="Prefer local runtimes for simple tasks before going remote"
      icon="home_work"
    >
      <div className="flex flex-col gap-4">
        <SectionRow
          title="Enable local-first"
          description="Route simple tasks to local runtimes when they are reachable."
          checked={form.enabled}
          onChange={(value) => setField("enabled", value)}
          disabled={loading}
        />
        {form.enabled && (
          <>
            <div className="pt-1 flex flex-col gap-2">
              <label className="font-medium text-sm sm:text-base">Runtimes</label>
              <div className="flex flex-wrap gap-2">
                {RUNTIMES.map((runtime) => {
                  const active = form.runtimes.includes(runtime.value);
                  return (
                    <button
                      key={runtime.value}
                      type="button"
                      onClick={() => toggleRuntime(runtime.value)}
                      disabled={loading}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition-colors",
                        active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-text-muted hover:bg-surface-2 hover:text-text-main",
                      )}
                    >
                      {runtime.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <SectionRow
              title="Fall back to remote"
              description="If every local runtime fails, continue with cloud providers."
              checked={form.fallbackIfLocalFail}
              onChange={(value) => setField("fallbackIfLocalFail", value)}
              disabled={loading}
            />
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base">Probe timeout (ms)</p>
                <p className="text-xs sm:text-sm text-text-muted">
                  How long to wait when checking a local runtime.
                </p>
              </div>
              <Input
                type="number"
                min="100"
                max="30000"
                value={form.probeTimeoutMs}
                onChange={(e) => setField("probeTimeoutMs", e.target.value)}
                disabled={loading}
                className="w-24 text-center shrink-0"
                aria-label="Local runtime probe timeout"
              />
            </div>
          </>
        )}
        <SaveBar onSave={handleSave} saving={saving} status={status} disabled={loading} saveLabel="Save local-first settings" />
      </div>
    </Card>
  );
}

const OPTIMIZER_MODES = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "full", label: "Full (LLM)" },
  { value: "off", label: "Off" },
];

function PromptOptimizerCard() {
  const { form, setField, save, loading, saving, status } = useSettingsSection(
    (settings) => ({
      enabled: settings?.promptOptimizer?.enabled === true,
      mode: settings?.promptOptimizer?.mode || "auto",
      minLength: settings?.promptOptimizer?.minLength ?? 20,
      timeoutMs: settings?.promptOptimizer?.timeoutMs ?? 8000,
      llmModel: settings?.promptOptimizer?.llmModel || "gpt-5-mini",
      llmEndpoint: settings?.promptOptimizer?.llmEndpoint || "http://localhost:20128/v1/chat/completions",
      llmApiKey: settings?.promptOptimizer?.llmApiKey || "",
    }),
  );

  const handleSave = () => {
    save(
      {
        promptOptimizer: {
          enabled: form.enabled,
          mode: form.mode,
          minLength: clamp(form.minLength, 5, 10000, 20),
          timeoutMs: clamp(form.timeoutMs, 250, 60000, 8000),
          llmModel: form.llmModel || "gpt-5-mini",
          llmEndpoint: form.llmEndpoint || "http://localhost:20128/v1/chat/completions",
          llmApiKey: form.llmApiKey || "",
        },
      },
      "Prompt optimizer saved",
    );
  };

  return (
    <Card
      title="Prompt Optimizer"
      subtitle="Clean up sloppy prompts before they hit the model"
      icon="auto_fix_high"
    >
      <div className="flex flex-col gap-4">
        <SectionRow
          title="Enable prompt optimizer"
          description="Detect and repair common prompt issues before routing."
          checked={form.enabled}
          onChange={(value) => setField("enabled", value)}
          disabled={loading}
        />
        {form.enabled && form.mode !== "off" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <Field label="Mode">
                <Select
                  options={OPTIMIZER_MODES}
                  value={form.mode}
                  onChange={(e) => setField("mode", e.target.value)}
                  disabled={loading}
                  aria-label="Optimizer mode"
                />
              </Field>
              <Field label="Min length">
                <Input
                  type="number"
                  min="5"
                  max="10000"
                  value={form.minLength}
                  onChange={(e) => setField("minLength", e.target.value)}
                  disabled={loading}
                  aria-label="Minimum prompt length"
                />
              </Field>
              <Field label="Timeout (ms)">
                <Input
                  type="number"
                  min="250"
                  max="60000"
                  value={form.timeoutMs}
                  onChange={(e) => setField("timeoutMs", e.target.value)}
                  disabled={loading}
                  aria-label="Optimizer timeout"
                />
              </Field>
            </div>
            {form.mode === "full" && (
              <Field label="LLM model" hint="Used by Full mode to rewrite prompts.">
                <Input
                  value={form.llmModel}
                  onChange={(e) => setField("llmModel", e.target.value)}
                  disabled={loading}
                  aria-label="Optimizer LLM model"
                />
              </Field>
            )}
          </>
        )}
        <SaveBar onSave={handleSave} saving={saving} status={status} disabled={loading} saveLabel="Save optimizer settings" />
      </div>
    </Card>
  );
}

export default function OptimizationSection() {
  return (
    <div className="flex flex-col gap-6">
      <SemanticCacheCard />
      <SemanticCompressCard />
      <LocalFirstCard />
      <PromptOptimizerCard />
    </div>
  );
}
