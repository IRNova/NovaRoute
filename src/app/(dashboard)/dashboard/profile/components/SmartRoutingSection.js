"use client";

import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";
import useSettingsSection from "./useSettingsSection";
import SectionRow from "./SectionRow";
import SaveBar from "./SaveBar";

export default function SmartRoutingSection() {
  const { form, setField, save, loading, saving, status } = useSettingsSection(
    (settings) => ({
      enabled: settings?.smartRoutingEnabled !== false,
      maxCandidates: settings?.smartRoutingMaxCandidates ?? 6,
      reorderCombo: settings?.smartReorderCombo === true,
    }),
  );

  const handleSave = () => {
    const maxCandidates = Math.min(
      20,
      Math.max(1, Number(form.maxCandidates) || 6),
    );
    save(
      {
        smartRoutingEnabled: form.enabled,
        smartRoutingMaxCandidates: maxCandidates,
        smartReorderCombo: form.reorderCombo,
      },
      "Smart routing settings saved",
    );
  };

  return (
    <Card
      title="Smart Routing"
      subtitle="Pick the best candidate upstream automatically"
      icon="psychology"
    >
      <div className="flex flex-col gap-4">
        <SectionRow
          title="Enable smart routing"
          description="Score candidate models on capability fit and pick the strongest match instead of the first one."
          checked={form.enabled}
          onChange={(value) => setField("enabled", value)}
          disabled={loading}
        />
        {form.enabled && (
          <>
            <SectionRow
              title="Reorder combo targets"
              description="When a combo runs, apply smart routing to order its targets before the fallback chain starts."
              checked={form.reorderCombo}
              onChange={(value) => setField("reorderCombo", value)}
              disabled={loading}
            />
            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base">
                  Max candidates
                </p>
                <p className="text-xs sm:text-sm text-text-muted">
                  How many candidate models are scored per request (1-20).
                </p>
              </div>
              <Input
                type="number"
                min="1"
                max="20"
                value={form.maxCandidates}
                onChange={(e) => setField("maxCandidates", e.target.value)}
                disabled={loading}
                className="w-20 text-center shrink-0"
                aria-label="Maximum smart routing candidates"
              />
            </div>
          </>
        )}
        <SaveBar
          onSave={handleSave}
          saving={saving}
          status={status}
          disabled={loading}
          saveLabel="Save smart routing"
        />
      </div>
    </Card>
  );
}
