"use client";

import { useState, useEffect } from "react";
import Card from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import { translate } from "@/i18n/runtime";

const KIND_COLORS = {
  llm: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  embedding: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  image: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  tts: "bg-green-500/10 text-green-600 dark:text-green-400",
  stt: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  video: "bg-red-500/10 text-red-600 dark:text-red-400",
  default: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

function formatNumber(num) {
  if (!num) return "—";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

export default function DefaultModelsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProviders, setExpandedProviders] = useState(new Set());

  useEffect(() => {
    fetch("/api/providers/default-models")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-text-muted">
          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          <span className="text-sm">{translate("Loading")}...</span>
        </div>
      </Card>
    );
  }

  if (!data?.providers) {
    return null;
  }

  const providers = data.providers;
  const providerEntries = Object.entries(providers);
  
  // Filter by search
  const filtered = searchQuery.trim()
    ? providerEntries.filter(([id, models]) => {
        const q = searchQuery.toLowerCase();
        return id.toLowerCase().includes(q) || 
          models.some(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
      })
    : providerEntries;

  const toggleProvider = (id) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalModels = providerEntries.reduce((sum, [_, models]) => sum + models.length, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-primary">model_training</span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            {translate("Default Models")}
          </h2>
          <Badge size="sm">{providerEntries.length} {translate("providers")} · {totalModels} {translate("models")}</Badge>
        </div>
      </div>
      
      <div className="p-5 space-y-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-text-muted">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={translate("Search models...")}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-border bg-surface text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>

        {/* Provider list */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
          {filtered.map(([providerId, models]) => {
            const isExpanded = expandedProviders.has(providerId);
            const displayModels = isExpanded ? models : models.slice(0, 5);
            
            return (
              <div key={providerId} className="rounded-xl border border-border bg-surface-2/30 overflow-hidden">
                <button
                  onClick={() => toggleProvider(providerId)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/60 transition-colors text-start"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                    <div>
                      <span className="text-sm font-semibold text-text-main">{providerId}</span>
                      <span className="text-xs text-text-muted ms-2">{models.length} {translate("models")}</span>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-[18px] text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>
                
                <div className="px-4 pb-3 space-y-1.5">
                  {displayModels.map((model) => (
                    <div key={model.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-2/40 transition-colors">
                      <span className="material-symbols-outlined text-[14px] text-text-muted">smart_toy</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-text-main truncate">{model.id}</span>
                          <Badge size="sm" className={KIND_COLORS[model.kind] || KIND_COLORS.default}>
                            {model.kind}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted shrink-0">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">token</span>
                          {formatNumber(model.contextWindow)}
                        </span>
                        {model.maxOutput && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">output</span>
                            {formatNumber(model.maxOutput)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {!isExpanded && models.length > 5 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleProvider(providerId); }}
                      className="text-xs text-primary hover:underline px-2 py-1"
                    >
                      +{models.length - 5} {translate("more")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
