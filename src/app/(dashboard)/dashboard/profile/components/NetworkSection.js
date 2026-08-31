"use client";

import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";
import useSettingsSection from "./useSettingsSection";
import SaveBar from "./SaveBar";

export default function NetworkSection() {
  const { form, setField, save, loading, saving, status } = useSettingsSection(
    (settings) => ({
      mitmRouterBaseUrl: settings?.mitmRouterBaseUrl || "http://localhost:20128",
    }),
  );

  const handleSave = () => {
    const url = (form.mitmRouterBaseUrl || "").trim();
    if (!url) {
      save({ mitmRouterBaseUrl: "http://localhost:20128" });
      return;
    }
    save({ mitmRouterBaseUrl: url }, "Network settings saved");
  };

  return (
    <Card
      title="Local Router"
      subtitle="Base URL used by MITM tools to reach this proxy"
      icon="dns"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="font-medium text-sm sm:text-base">
            MITM router base URL
          </label>
          <Input
            placeholder="http://localhost:20128"
            value={form.mitmRouterBaseUrl}
            onChange={(e) => setField("mitmRouterBaseUrl", e.target.value)}
            disabled={loading}
            aria-label="MITM router base URL"
          />
          <p className="text-xs sm:text-sm text-text-muted">
            Where the MITM proxy and related tools should forward traffic.
          </p>
        </div>
        <SaveBar
          onSave={handleSave}
          saving={saving}
          status={status}
          disabled={loading}
          saveLabel="Save network settings"
        />
      </div>
    </Card>
  );
}
