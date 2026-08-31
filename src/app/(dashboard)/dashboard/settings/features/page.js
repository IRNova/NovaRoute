"use client";
import { useState } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Input from "@/shared/components/Input";
import Button from "@/shared/components/Button";
import { useSettings } from "../SettingsShell";

const FEATURE_FLAGS = [
  { key: "autoCombo", label: "Auto Combo", description: "Automatically build combo chains from model availability", category: "Routing" },
  { key: "adaptiveRouting", label: "Adaptive Routing", description: "Use task detection and scoring for smart model selection", category: "Routing" },
  { key: "geniusMode", label: "Genius Mode", description: "Quality-first model selection with expanded candidate pool", category: "Routing" },
  { key: "localFirst", label: "Local-First", description: "Prefer local runtimes (Ollama, LM Studio, llama.cpp)", category: "Routing" },
  { key: "semanticCache", label: "Semantic Cache", description: "Cache similar responses to reduce API calls", category: "Performance" },
  { key: "promptOptimizer", label: "Prompt Optimizer", description: "Compress prompts to reduce token usage", category: "Performance" },
  { key: "headroomProxy", label: "Headroom Proxy", description: "Route requests through Headroom compression proxy", category: "Performance" },
  { key: "tokenSaver", label: "Token Saver (RTK)", description: "Compress tool results and system prompts", category: "Performance" },
  { key: "embeddings", label: "Embeddings", description: "Enable /v1/embeddings endpoint", category: "Endpoints" },
  { key: "search", label: "Web Search", description: "Enable /v1/search endpoint", category: "Endpoints" },
  { key: "tts", label: "Text-to-Speech", description: "Enable /v1/audio/speech endpoint", category: "Endpoints" },
  { key: "stt", label: "Speech-to-Text", description: "Enable /v1/audio/transcriptions endpoint", category: "Endpoints" },
  { key: "imageGeneration", label: "Image Generation", description: "Enable /v1/images/generations endpoint", category: "Endpoints" },
  { key: "videoGeneration", label: "Video Generation", description: "Enable /v1/videos endpoint", category: "Endpoints" },
  { key: "requestLogging", label: "Request Logging", description: "Log request details for analytics", category: "Observability" },
  { key: "usageTracking", label: "Usage Tracking", description: "Track token usage and costs", category: "Observability" },
  { key: "consoleLogCapture", label: "Console Log Capture", description: "Capture and display console logs in dashboard", category: "Observability" },
  { key: "cloudSync", label: "Cloud Sync", description: "Sync state to cloud for multi-device access", category: "Advanced" },
  { key: "mitmProxy", label: "MITM Proxy", description: "Enable MITM proxy for traffic inspection", category: "Advanced" },
  { key: "pxpipe", label: "PxPipe", description: "Enable PxPipe proxy for request transformation", category: "Advanced" },
  { key: "comboFusion", label: "Combo Fusion", description: "Enable fusion chat mode for multi-model collaboration", category: "Routing" },
  { key: "chaosMode", label: "Chaos Mode", description: "Randomly test failure scenarios for resilience", category: "Advanced" },
];

const CATEGORIES = [...new Set(FEATURE_FLAGS.map((f) => f.category))];

export default function FeaturesSettingsPage() {
  const { settings, save } = useSettings();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  if (!settings) return null;

  const flags = settings.featureFlags || {};

  const toggle = (key) => {
    save({ featureFlags: { ...flags, [key]: !flags[key] } });
  };

  const filtered = FEATURE_FLAGS.filter((f) => {
    if (filter !== "all" && f.category !== filter) return false;
    if (search && !f.label.toLowerCase().includes(search.toLowerCase()) && !f.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-1">
            {["all", ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filter === cat
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface-2"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {CATEGORIES.filter((cat) => filter === "all" || filter === cat).map((cat) => {
        const items = filtered.filter((f) => f.category === cat);
        if (items.length === 0) return null;
        return (
          <Card key={cat} className="p-5 space-y-1">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">{cat}</h3>
            {items.map((flag) => (
              <div key={flag.key} className="flex items-center justify-between gap-4 py-2.5 border-b border-surface-3 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-main">{flag.label}</p>
                  <p className="text-xs text-text-muted">{flag.description}</p>
                </div>
                <Toggle checked={!!flags[flag.key]} onChange={() => toggle(flag.key)} />
              </div>
            ))}
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => save({ featureFlags: {} })}
        >
          Reset All to Defaults
        </Button>
      </div>
    </div>
  );
}
