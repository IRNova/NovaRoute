"use client";

import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";
import useSettingsSection from "./useSettingsSection";
import SaveBar from "./SaveBar";

export default function ObservabilitySection() {
  const { form, setField, save, loading, saving, status } = useSettingsSection(
    (settings) => ({
      maxRecords: settings?.observabilityMaxRecords ?? 1000,
      batchSize: settings?.observabilityBatchSize ?? 20,
      flushIntervalMs: settings?.observabilityFlushIntervalMs ?? 5000,
      maxJsonSize: settings?.observabilityMaxJsonSize ?? 5,
    }),
  );

  const clamp = (value, min, max, fallback) =>
    Math.min(max, Math.max(min, Number(value) || fallback));

  const handleSave = () => {
    save(
      {
        observabilityMaxRecords: clamp(form.maxRecords, 50, 100000, 1000),
        observabilityBatchSize: clamp(form.batchSize, 1, 500, 20),
        observabilityFlushIntervalMs: clamp(form.flushIntervalMs, 250, 60000, 5000),
        observabilityMaxJsonSize: clamp(form.maxJsonSize, 1, 50, 5),
      },
      "Observability settings saved",
    );
  };

  const fields = [
    {
      key: "maxRecords",
      label: "Max records",
      hint: "How many request records to keep (50-100000).",
      min: 50,
      max: 100000,
    },
    {
      key: "batchSize",
      label: "Batch size",
      hint: "Records written per flush batch (1-500).",
      min: 1,
      max: 500,
    },
    {
      key: "flushIntervalMs",
      label: "Flush interval (ms)",
      hint: "How often buffered records are written (250-60000).",
      min: 250,
      max: 60000,
    },
    {
      key: "maxJsonSize",
      label: "Max payload (KB)",
      hint: "Requests larger than this are not recorded (1-50).",
      min: 1,
      max: 50,
    },
  ];

  return (
    <Card
      title="Observability Tuning"
      subtitle="Fine-tune how request records are captured and written"
      icon="monitoring"
    >
      <div className="flex flex-col gap-4">
        {fields.map((field) => (
          <div
            key={field.key}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm sm:text-base">{field.label}</p>
              <p className="text-xs sm:text-sm text-text-muted">{field.hint}</p>
            </div>
            <Input
              type="number"
              min={field.min}
              max={field.max}
              value={form[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              disabled={loading}
              className="w-24 text-center shrink-0"
              aria-label={field.label}
            />
          </div>
        ))}
        <SaveBar
          onSave={handleSave}
          saving={saving}
          status={status}
          disabled={loading}
          saveLabel="Save observability settings"
        />
      </div>
    </Card>
  );
}
