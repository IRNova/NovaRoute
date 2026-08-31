"use client";

import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";
import useSettingsSection from "./useSettingsSection";
import SectionRow from "./SectionRow";
import SaveBar from "./SaveBar";

export default function QuotaSection() {
  const { form, setField, save, loading, saving, status } = useSettingsSection(
    (settings) => ({
      enabled: settings?.autoRefreshProviderQuota !== false,
      interval: settings?.autoRefreshProviderQuotaInterval ?? 60,
    }),
  );

  const handleSave = () => {
    const interval = Math.min(
      3600,
      Math.max(5, Number(form.interval) || 60),
    );
    save(
      {
        autoRefreshProviderQuota: form.enabled,
        autoRefreshProviderQuotaInterval: interval,
      },
      "Auto-refresh settings saved",
    );
  };

  return (
    <Card
      title="Quota Auto-Refresh"
      subtitle="Keep the Quota Tracker up to date automatically"
      icon="data_usage"
    >
      <div className="flex flex-col gap-4">
        <SectionRow
          title="Auto-refresh quota"
          description="Periodically poll provider quota limits without manual refreshes."
          checked={form.enabled}
          onChange={(value) => setField("enabled", value)}
          disabled={loading}
        >
          {form.enabled && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Interval (seconds)</label>
              <Input
                type="number"
                min="5"
                max="3600"
                value={form.interval}
                onChange={(e) => setField("interval", e.target.value)}
                disabled={loading}
                className="w-32 text-center"
                aria-label="Auto-refresh interval in seconds"
              />
              <p className="text-xs text-text-muted">
                Between 5 and 3600. The per-page toggle on the Quota Tracker
                still overrides this for the current session.
              </p>
            </div>
          )}
        </SectionRow>
        <SaveBar
          onSave={handleSave}
          saving={saving}
          status={status}
          disabled={loading}
          saveLabel="Save quota settings"
        />
      </div>
    </Card>
  );
}
