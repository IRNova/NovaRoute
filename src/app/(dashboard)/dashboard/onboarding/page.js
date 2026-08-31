"use client";
import { translate } from "@/i18n/runtime";
import { useState } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import { useRouter } from "next/navigation";

const STEPS = [
  { id: "welcome", title: translate("Welcome to NovaRoute"), desc: "Your local AI routing gateway", icon: "waving_hand" },
  { id: "provider", title: translate("Connect a Provider"), desc: "Add your first AI provider API key", icon: "key" },
  { id: "model", title: translate("Choose Default Model"), desc: "Set the default model for requests", icon: "smart_toy" },
  { id: "endpoint", title: translate("Configure Endpoint"), desc: "Set up your API endpoint", icon: "api" },
  { id: "security", title: translate("Security Setup"), desc: "Configure authentication", icon: "shield" },
  { id: "done", title: translate("All Set!"), desc: "Start sending requests", icon: "celebration" },
];

const TIERS = [
  { name: "Free", desc: "Use free-tier providers and Radar discoveries", icon: "money_off", color: "text-success" },
  { name: "Starter", desc: "Add 1–2 API keys for personal use", icon: "person", color: "text-primary" },
  { name: "Pro", desc: "Multi-provider combos, caching, monitoring", icon: "workspace_premium", color: "text-warning" },
  { name: "Team", desc: "Shared keys, quotas, audit logs, webhooks", icon: "groups", color: "text-purple-400" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selectedTier, setSelectedTier] = useState("Starter");
  const router = useRouter();
  const current = STEPS[step];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-main">{translate("Getting Started")}</h1>
        <p className="text-sm text-text-muted mt-1">{translate("Set up NovaRoute in a few steps")}</p>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => setStep(i)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? "bg-success text-white" : i === step ? "bg-primary text-white" : "bg-surface-3 text-text-muted"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </button>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? "bg-success" : "bg-surface-3"}`} />}
          </div>
        ))}
      </div>

      <Card className="p-8 text-center">
        <span className="material-symbols-outlined text-[64px] text-primary mb-4">{current.icon}</span>
        <h2 className="text-xl font-bold text-text-main">{current.title}</h2>
        <p className="text-sm text-text-muted mt-2">{current.desc}</p>
      </Card>

      {step === 1 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-main mb-3">{translate("Start with free providers")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["Hugging Face", "OpenRouter Free", "GitHub Models", "Google Free"].map((p) => (
              <div key={p} className="p-3 rounded-xl bg-surface-3/30 text-center">
                <p className="text-xs font-medium text-text-main">{p}</p>
                <Badge variant="success" size="sm" className="mt-2">Free tier</Badge>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => router.push("/dashboard/discovery")}>{translate("Browse free providers")}</Button>
        </Card>
      )}

      {step === 5 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-main mb-3">{translate("Pick your starting tier")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TIERS.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelectedTier(t.name)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  selectedTier === t.name ? "border-primary bg-primary/5" : "border-border bg-surface hover:bg-surface-2"
                }`}
              >
                <span className={`material-symbols-outlined text-[24px] ${t.color}`}>{t.icon}</span>
                <div>
                  <p className="text-sm font-medium text-text-main">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>{translate("Back")}</Button>
        {step === STEPS.length - 1 ? (
          <Button onClick={() => router.push("/dashboard/usage")}>{translate("Go to Dashboard")}</Button>
        ) : (
          <Button onClick={() => setStep(step + 1)}>{translate("Next")}</Button>
        )}
      </div>
    </div>
  );
}
