"use client";
import { useState, useCallback } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";
import Button from "@/shared/components/Button";
import ModelSelectModal from "@/shared/components/ModelSelectModal";
import CapacityBadges from "@/shared/components/CapacityBadges";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { useSettings } from "../SettingsShell";
import { translate } from "@/i18n/runtime";
import { cn } from "@/shared/utils/cn";

const TABS = [
  { id: "vision", label: "Vision", icon: "image" },
  { id: "audio", label: "Audio", icon: "mic" },
  { id: "video", label: "Video", icon: "videocam" },
  { id: "adapter", label: "Adapter", icon: "menu_book" },
];

const CAPACITY_ADAPTER_CAPS = [
  { key: "vision", label: "Vision", icon: "visibility", desc: "تصاویر" },
  { key: "audioInput", label: "Audio", icon: "graphic_eq", desc: "ورودی صدا" },
];
const EMPTY_CAP_ENTRY = { enabled: false, roundRobin: false, models: [] };
const EMPTY_CAPACITY_ADAPTER = {
  vision: { ...EMPTY_CAP_ENTRY },
  pdf: { ...EMPTY_CAP_ENTRY },
  audioInput: { ...EMPTY_CAP_ENTRY },
  videoInput: { ...EMPTY_CAP_ENTRY },
};

function normalizeCapEntry(entry) {
  if (Array.isArray(entry)) {
    return { enabled: true, roundRobin: false, models: entry.map((e) => e?.model || e).filter(Boolean) };
  }
  if (entry && typeof entry === "object") {
    return {
      enabled: entry.enabled !== false,
      roundRobin: !!entry.roundRobin,
      models: Array.isArray(entry.models) ? entry.models.filter(Boolean) : [],
    };
  }
  return { ...EMPTY_CAP_ENTRY };
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

function CapacityAdapterCap({ cap, entry, onChange, activeProviders, getCaps }) {
  const [showModelSelect, setShowModelSelect] = useState(false);
  const { enabled, roundRobin, models } = entry;

  const patch = useCallback((p) => onChange({ ...entry, ...p }), [entry, onChange]);

  const handleAdd = (model) => {
    if (models.includes(model.value)) return;
    patch({ models: [...models, model.value] });
  };

  const handleRemove = (index) => {
    const next = models.filter((_, i) => i !== index);
    patch({ models: next });
  };

  const handleMove = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= models.length) return;
    const next = [...models];
    [next[index], next[target]] = [next[target], next[index]];
    patch({ models: next });
  };

  return (
    <div className={cn("rounded-xl border bg-surface-2/40 p-4 transition-opacity", enabled ? "border-border" : "border-border/60 opacity-60")}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[20px]">{cap.icon}</span>
          </div>
          <div>
            <h3 className="font-semibold text-text-main">{cap.label}</h3>
            <p className="text-xs text-text-muted">{cap.desc}</p>
          </div>
        </div>
        <Toggle checked={enabled} onChange={(v) => patch({ enabled: v })} aria-label={`Enable ${cap.label} adapter`} />
      </div>

      <div className="min-h-[44px] rounded-xl border border-border bg-surface px-3 py-2 mb-3">
        {models.length === 0 ? (
          <span className="text-xs text-text-muted italic">{translate("No fallback models")}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {models.map((model, index) => (
              <code
                key={`${model}-${index}`}
                className="group/chip inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-text-muted"
              >
                <span className="truncate max-w-[140px]">{model}</span>
                <CapacityBadges caps={getCaps?.(model)} />
                <span className="flex items-center gap-0.5 opacity-0 group-hover/chip:opacity-100 transition-opacity">
                  <button onClick={() => handleMove(index, -1)} disabled={index === 0} className={cn("p-0.5 rounded", index === 0 ? "text-text-muted/20" : "hover:text-primary")}>
                    <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                  </button>
                  <button onClick={() => handleMove(index, 1)} disabled={index === models.length - 1} className={cn("p-0.5 rounded", index === models.length - 1 ? "text-text-muted/20" : "hover:text-primary")}>
                    <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
                  </button>
                  <button onClick={() => handleRemove(index)} className="p-0.5 rounded hover:text-red-500">
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </span>
              </code>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
          <Toggle checked={roundRobin} onChange={(v) => patch({ roundRobin: v })} disabled={!enabled} aria-label={`Round-robin ${cap.label} adapter`} />
          <span>{translate("Round-robin fallback")}</span>
        </label>
        <Button
          icon="add"
          variant="ghost"
          size="sm"
          onClick={() => setShowModelSelect(true)}
          disabled={!enabled}
          title={`Add ${cap.label} model`}
        >
          {translate("Add Model")}
        </Button>
      </div>

      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAdd}
          activeProviders={activeProviders}
          title={`Add ${cap.label} Model`}
          addedModelValues={models}
          capFilter={cap.key}
          closeOnSelect={false}
        />
      )}
    </div>
  );
}

export default function ModalityBridgeSettingsPage() {
  const { settings, save } = useSettings();
  const [activeTab, setActiveTab] = useState("vision");
  const [activeProviders, setActiveProviders] = useState([]);
  const { getCaps } = useModelCaps();

  if (!settings) return null;

  const modality = settings.modalityBridge || {};
  const update = (patch) => save({ modalityBridge: { ...modality, ...patch } });

  const vision = modality.vision || {};
  const updateVision = (patch) => update({ vision: { ...vision, ...patch } });

  const audio = modality.audio || {};
  const updateAudio = (patch) => update({ audio: { ...audio, ...patch } });

  const rawAdapter = settings.capacityAdapter || {};
  const capacityAdapter = {};
  for (const cap of CAPACITY_ADAPTER_CAPS) {
    capacityAdapter[cap.key] = normalizeCapEntry(rawAdapter[cap.key]);
  }

  const handleSetCapacityAdapter = async (next) => {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacityAdapter: next }),
      });
    } catch (error) {
      console.log("Error updating capacity adapter:", error);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">
        {translate("Route non-text requests (images, audio, video) to dedicated models and providers.")}
      </p>

      <div className="flex gap-1 border-b border-border pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "vision" && (
        <Section title={translate("Vision Routing")} description={translate("Image understanding and multi-modal inputs")}>
          <FieldRow label={translate("Enable Vision Bridge")}>
            <Toggle
              checked={vision.enabled ?? false}
              onChange={(val) => updateVision({ enabled: val })}
            />
          </FieldRow>
          {vision.enabled && (
            <>
              <FieldRow label={translate("Default Provider")}>
                <Input
                  placeholder="e.g. openai"
                  value={vision.provider || ""}
                  onChange={(e) => updateVision({ provider: e.target.value })}
                  className="w-40"
                />
              </FieldRow>
              <FieldRow label={translate("Default Model")}>
                <Input
                  placeholder="e.g. gpt-4o"
                  value={vision.model || ""}
                  onChange={(e) => updateVision({ model: e.target.value })}
                  className="w-48"
                />
              </FieldRow>
              <FieldRow label={translate("Max Images per Request")}>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={vision.maxImages ?? 8}
                  onChange={(e) => updateVision({ maxImages: parseInt(e.target.value) || 8 })}
                  className="w-20 text-center"
                />
              </FieldRow>
              <FieldRow label={translate("Image Detail")} description={translate("Default detail level for image inputs")}>
                <Select
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "low", label: "Low" },
                    { value: "high", label: "High" },
                  ]}
                  value={vision.detail || "auto"}
                  onChange={(e) => updateVision({ detail: e.target.value })}
                />
              </FieldRow>
            </>
          )}
        </Section>
      )}

      {activeTab === "audio" && (
        <Section title={translate("Audio Routing")} description={translate("Text-to-speech and speech-to-text endpoints")}>
          <FieldRow label={translate("Enable Audio Bridge")}>
            <Toggle
              checked={audio.enabled ?? false}
              onChange={(val) => updateAudio({ enabled: val })}
            />
          </FieldRow>
          {audio.enabled && (
            <>
              <FieldRow label={translate("TTS Model")}>
                <Input
                  placeholder="e.g. tts-1"
                  value={audio.ttsModel || ""}
                  onChange={(e) => updateAudio({ ttsModel: e.target.value })}
                  className="w-40"
                />
              </FieldRow>
              <FieldRow label={translate("TTS Voice")}>
                <Input
                  placeholder="e.g. alloy"
                  value={audio.ttsVoice || ""}
                  onChange={(e) => updateAudio({ ttsVoice: e.target.value })}
                  className="w-40"
                />
              </FieldRow>
              <FieldRow label={translate("STT Model")}>
                <Input
                  placeholder="e.g. whisper-1"
                  value={audio.sttModel || ""}
                  onChange={(e) => updateAudio({ sttModel: e.target.value })}
                  className="w-40"
                />
              </FieldRow>
              <FieldRow label={translate("Output Format")}>
                <Select
                  options={[
                    { value: "mp3", label: "MP3" },
                    { value: "opus", label: "Opus" },
                    { value: "aac", label: "AAC" },
                    { value: "flac", label: "FLAC" },
                    { value: "pcm", label: "PCM" },
                  ]}
                  value={audio.format || "mp3"}
                  onChange={(e) => updateAudio({ format: e.target.value })}
                />
              </FieldRow>
            </>
          )}
        </Section>
      )}

      {activeTab === "video" && (
        <Card className="p-8 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-text-muted">videocam_off</span>
          <h3 className="text-sm font-semibold text-text-main">{translate("Video bridge coming soon")}</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {translate("Video generation and understanding routing will be configurable here in a future release.")}
          </p>
        </Card>
      )}

      {activeTab === "adapter" && (
        <div className="space-y-6">
          <Section
            title={translate("Vision Adapter")}
            description={translate("When your chosen model can't read image or audio input, NovaRoute automatically switches to a model in the pool below.")}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {CAPACITY_ADAPTER_CAPS.map((cap) => (
                <CapacityAdapterCap
                  key={cap.key}
                  cap={cap}
                  entry={capacityAdapter[cap.key] || EMPTY_CAP_ENTRY}
                  onChange={(entry) => handleSetCapacityAdapter({ ...rawAdapter, [cap.key]: entry })}
                  activeProviders={activeProviders}
                  getCaps={getCaps}
                />
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
