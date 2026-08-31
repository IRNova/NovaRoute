"use client";
import { useState } from "react";
import { Card, Button, Badge } from "@/shared/components";
import Modal from "@/shared/components/Modal";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to NovaRoute",
    description: "Set up your first AI provider in a few steps.",
    icon: "waving_hand",
  },
  {
    id: "choose",
    title: "Choose a Provider",
    description: "Select which AI provider you want to connect.",
    icon: "cloud",
  },
  {
    id: "credentials",
    title: "Add Credentials",
    description: "Enter your API key or OAuth credentials.",
    icon: "key",
  },
  {
    id: "test",
    title: "Test Connection",
    description: "Verify the connection works with a test request.",
    icon: "check_circle",
  },
  {
    id: "done",
    title: "All Set!",
    description: "Your provider is connected and ready to use.",
    icon: "celebration",
  },
];

const POPULAR_PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "smart_toy", desc: "GPT-4o, GPT-4, GPT-3.5" },
  { id: "claude", name: "Anthropic Claude", icon: "psychology", desc: "Claude 4, Claude 3.5" },
  { id: "gemini", name: "Google Gemini", icon: "auto_awesome", desc: "Gemini 2.5, Gemini 2.0" },
  { id: "deepseek", name: "DeepSeek", icon: "search", desc: "DeepSeek V3, R1" },
  { id: "grok", name: "xAI Grok", icon: "bolt", desc: "Grok 3, Grok 2" },
  { id: "mistral", name: "Mistral", icon: "air", desc: "Mistral Large, Medium" },
  { id: "ollama-local", name: "Ollama (Local)", icon: "computer", desc: "Llama, Mistral, Qwen" },
  { id: "copilot", name: "GitHub Copilot", icon: "code", desc: "Copilot models" },
];

export default function OnboardingWizard({ isOpen, onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const currentStep = STEPS[step];

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/providers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, apiKey }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) handleNext();
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleFinish = () => {
    onComplete?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Setup Wizard" size="lg">
      <div className="space-y-6">
        {/* Progress */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step
                    ? "bg-success text-white"
                    : i === step
                    ? "bg-primary text-white"
                    : "bg-surface-3 text-text-muted"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 ${i < step ? "bg-success" : "bg-surface-3"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="p-6 text-center">
          <span className="material-symbols-outlined text-[48px] text-primary mb-3">{currentStep.icon}</span>
          <h3 className="text-lg font-bold text-text-main">{currentStep.title}</h3>
          <p className="text-sm text-text-muted mt-1">{currentStep.description}</p>
        </Card>

        {/* Step: Choose Provider */}
        {currentStep.id === "choose" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {POPULAR_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selectedProvider === p.id
                    ? "border-primary bg-primary/5"
                    : "border-surface-3 hover:border-surface-3/80"
                }`}
              >
                <span className="material-symbols-outlined text-[24px] text-primary">{p.icon}</span>
                <p className="text-sm font-medium text-text-main mt-2">{p.name}</p>
                <p className="text-xs text-text-muted">{p.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step: Credentials */}
        {currentStep.id === "credentials" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-main mb-1.5 block">API Key for {selectedProvider}</label>
              <input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full py-2.5 px-3 bg-surface-2 border border-surface-3 rounded-xl text-sm text-text-main"
              />
            </div>
            <p className="text-xs text-text-muted">Your API key is stored locally and never sent to third parties.</p>
          </div>
        )}

        {/* Step: Test */}
        {currentStep.id === "test" && (
          <div className="space-y-4">
            {testResult && (
              <div className={`p-4 rounded-xl ${testResult.success ? "bg-success/10" : "bg-danger/10"}`}>
                <p className={`text-sm font-medium ${testResult.success ? "text-success" : "text-danger"}`}>
                  {testResult.success ? "Connection successful!" : `Failed: ${testResult.error}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step: Done */}
        {currentStep.id === "done" && (
          <Card className="p-6 text-center bg-success/5 border-success/20">
            <span className="material-symbols-outlined text-[48px] text-success mb-3">check_circle</span>
            <p className="text-sm text-text-main">Your provider is connected. You can now send requests through /v1.</p>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 0}>Back</Button>
          <div className="flex gap-2">
            {currentStep.id === "test" ? (
              <Button onClick={handleTest} disabled={testing || !apiKey}>
                {testing ? "Testing..." : "Test Connection"}
              </Button>
            ) : currentStep.id === "done" ? (
              <Button onClick={handleFinish}>Finish</Button>
            ) : (
              <Button onClick={handleNext} disabled={currentStep.id === "choose" && !selectedProvider}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
