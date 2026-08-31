"use client";

import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import Button from "@/shared/components/Button";

const FALLBACK_TIERS = [
  {
    provider: "Google AI Studio",
    color: "#4285F4",
    freeModels: ["Gemini 2.0 Flash", "Gemini 1.5 Pro", "Gemini 1.5 Flash", "Gemini 2.0 Flash-Lite"],
    dailyLimit: "1,500 RPM / 1M tokens/day",
    monthlyLimit: "Unlimited (rate-limited)",
    status: "active",
    signupUrl: "https://aistudio.google.com/",
  },
  {
    provider: "Groq",
    color: "#F55036",
    freeModels: ["Llama 3.3 70B", "Mixtral 8x7B", "Gemma 2 9B", "Whisper Large v3"],
    dailyLimit: "30 RPM / 14,400 requests/day",
    monthlyLimit: "Unlimited (rate-limited)",
    status: "active",
    signupUrl: "https://console.groq.com/",
  },
  {
    provider: "DeepSeek",
    color: "#4F46E5",
    freeModels: ["DeepSeek-V3", "DeepSeek-R1"],
    dailyLimit: "10 RPM / 1M tokens/day",
    monthlyLimit: "Unlimited (rate-limited)",
    status: "active",
    signupUrl: "https://platform.deepseek.com/",
  },
  {
    provider: "Cerebras",
    color: "#7C3AED",
    freeModels: ["Llama 3.3 70B", "Llama 3.1 8B", "Qwen 2.5 32B"],
    dailyLimit: "30 RPM / 1M tokens/day",
    monthlyLimit: "Unlimited (rate-limited)",
    status: "active",
    signupUrl: "https://cerebras.ai/",
  },
  {
    provider: "SambaNova",
    color: "#0EA5E9",
    freeModels: ["Llama 3.3 70B", "Llama 3.1 8B", "DeepSeek-R1"],
    dailyLimit: "10 RPM / 500K tokens/day",
    monthlyLimit: "Unlimited (rate-limited)",
    status: "active",
    signupUrl: "https://cloud.sambanova.ai/",
  },
  {
    provider: "Mistral",
    color: "#FF7000",
    freeModels: ["Mistral Small", "Mistral Nemo", "Pixtral 12B"],
    dailyLimit: "1 RPM / 50 requests/day",
    monthlyLimit: "Unlimited (rate-limited)",
    status: "active",
    signupUrl: "https://console.mistral.ai/",
  },
  {
    provider: "Together AI",
    color: "#10B981",
    freeModels: ["Llama 3.3 70B", "Qwen 2.5 72B", "DeepSeek-V3"],
    dailyLimit: "60 RPM / 10K credits",
    monthlyLimit: "$1 free credits/month",
    status: "active",
    signupUrl: "https://api.together.xyz/",
  },
  {
    provider: "Cloudflare Workers AI",
    color: "#F38020",
    freeModels: ["Llama 3.3 70B", "Llama 3.1 8B", "Mistral 7B", "Phi-3 Mini"],
    dailyLimit: "10,000 requests/day",
    monthlyLimit: "Unlimited (daily cap)",
    status: "active",
    signupUrl: "https://developers.cloudflare.com/workers-ai/",
  },
  {
    provider: "Hugging Face",
    color: "#FFD21E",
    freeModels: ["Llama 3.3 70B", "Mistral 7B", "Qwen 2.5 72B", "Phi-3"],
    dailyLimit: "300 requests/day / 30 RPM",
    monthlyLimit: "Unlimited (daily cap)",
    status: "limited",
    signupUrl: "https://huggingface.co/settings/tokens",
  },
  {
    provider: "Novita AI",
    color: "#8B5CF6",
    freeModels: ["Llama 3.3 70B", "DeepSeek-V3", "Qwen 2.5 72B"],
    dailyLimit: "20 RPM / 500K tokens/day",
    monthlyLimit: "Unlimited (rate-limited)",
    status: "active",
    signupUrl: "https://novita.ai/",
  },
];

function TierCard({ tier }) {
  const isActive = tier.status === "active";
  const isLimited = tier.status === "limited";

  return (
    <Card hover className="p-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-[10px] flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: tier.color || "#6B7280" }}
          >
            {tier.provider.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-text-main">{tier.provider}</h3>
            <Badge
              variant={isActive ? "success" : isLimited ? "warning" : "error"}
              size="sm"
              dot
            >
              {tier.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Free Models</p>
          <div className="flex flex-wrap gap-1.5">
            {tier.freeModels.map((m) => (
              <Badge key={m} variant="default" size="sm">{m}</Badge>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-bg p-3 border border-border-subtle space-y-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-text-muted">speed</span>
            <div>
              <p className="text-[10px] text-text-muted uppercase">Daily Limit</p>
              <p className="text-xs font-medium text-text-main">{tier.dailyLimit}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-text-muted">calendar_month</span>
            <div>
              <p className="text-[10px] text-text-muted uppercase">Monthly Limit</p>
              <p className="text-xs font-medium text-text-main">{tier.monthlyLimit}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border-subtle">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          icon="open_in_new"
          onClick={() => window.open(tier.signupUrl, "_blank", "noopener,noreferrer")}
        >
          Sign Up
        </Button>
      </div>
    </Card>
  );
}

export default function FreeTiersPage() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/free-tiers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setTiers(d?.tiers || FALLBACK_TIERS);
        setLoading(false);
      })
      .catch(() => {
        setTiers(FALLBACK_TIERS);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const activeCount = tiers.filter((t) => t.status === "active").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Free Tiers</h1>
          <p className="text-sm text-text-muted mt-1">Free tier details for each AI provider</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" size="md" dot>{activeCount} Active</Badge>
          <Badge variant="default" size="md">{tiers.length} Providers</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiers.map((tier) => (
          <TierCard key={tier.provider} tier={tier} />
        ))}
      </div>

      {tiers.length === 0 && (
        <Card className="p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted">cloud_off</span>
          <p className="text-sm text-text-muted mt-3">No free tier providers found</p>
        </Card>
      )}
    </div>
  );
}
