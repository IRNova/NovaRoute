"use client";
import { useState } from "react";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";

const AUTO_COMBOS = [
  {
    id: "code-review",
    name: "Code Review",
    description: "Best models for code review and analysis",
    models: ["claude-sonnet-4", "gpt-4o", "deepseek-v3"],
    strategy: "auto",
    tags: ["coding", "review"],
  },
  {
    id: "creative-writing",
    name: "Creative Writing",
    description: "Models optimized for creative content",
    models: ["claude-sonnet-4", "gpt-4o", "gemini-2.5-pro"],
    strategy: "quality-first",
    tags: ["creative", "writing"],
  },
  {
    id: "fast-chat",
    name: "Fast Chat",
    description: "Low-latency models for quick responses",
    models: ["gpt-4o-mini", "claude-haiku", "gemini-2.0-flash"],
    strategy: "latency-optimized",
    tags: ["fast", "chat"],
  },
  {
    id: "deep-reasoning",
    name: "Deep Reasoning",
    description: "Models with strong reasoning capabilities",
    models: ["o3", "claude-sonnet-4", "deepseek-r1"],
    strategy: "quality-first",
    tags: ["reasoning", "analysis"],
  },
  {
    id: "multi-modal",
    name: "Multi-Modal",
    description: "Models supporting images, audio, and video",
    models: ["gpt-4o", "gemini-2.5-pro", "claude-sonnet-4"],
    strategy: "capability-based",
    tags: ["vision", "audio", "video"],
  },
  {
    id: "cost-optimized",
    name: "Cost Optimized",
    description: "Cheapest models with good quality",
    models: ["gpt-4o-mini", "deepseek-v3", "gemini-2.0-flash"],
    strategy: "cost-optimized",
    tags: ["cheap", "budget"],
  },
];

export default function AutoComboCatalog({ onSelect }) {
  const [filter, setFilter] = useState("all");

  const allTags = [...new Set(AUTO_COMBOS.flatMap((c) => c.tags))];
  const filtered = filter === "all" ? AUTO_COMBOS : AUTO_COMBOS.filter((c) => c.tags.includes(filter));

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-main">Auto-Combo Catalog</h3>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === "all" ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface-2"
            }`}
          >
            All
          </button>
          {allTags.slice(0, 6).map((tag) => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === tag ? "bg-primary/10 text-primary" : "text-text-muted hover:bg-surface-2"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((combo) => (
          <Card key={combo.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect?.(combo)}>
            <h4 className="font-medium text-text-main text-sm">{combo.name}</h4>
            <p className="text-xs text-text-muted mt-1">{combo.description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {combo.models.map((m) => (
                <Badge key={m} size="sm">{m}</Badge>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <Badge variant="primary" size="sm">{combo.strategy}</Badge>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onSelect?.(combo); }}>
                Use
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
