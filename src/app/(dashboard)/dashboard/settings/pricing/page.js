"use client";
import { useState } from "react";
import Card from "@/shared/components/Card";
import Toggle from "@/shared/components/Toggle";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";
import Button from "@/shared/components/Button";
import PricingModal from "@/shared/components/PricingModal";
import { useSettings } from "../SettingsShell";

function Section({ title, description, children }) {
  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-main">{title}</h3>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function FieldRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-main">{label}</p>
        {description && <p className="text-xs text-text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "JPY", label: "JPY (¥)" },
];

export default function PricingSettingsPage() {
  const { settings, save } = useSettings();
  const [showModal, setShowModal] = useState(false);

  if (!settings) return null;

  const pricing = settings.pricing || {};
  const update = (patch) => save({ pricing: { ...pricing, ...patch } });

  return (
    <div className="space-y-6">
      <Section title="Cost Defaults" description="Global pricing and currency preferences">
        <FieldRow
          label="Default Markup"
          description="Markup percentage added to upstream costs (0 = no markup)"
        >
          <Input
            type="number"
            min={0}
            max={1000}
            step={0.1}
            value={pricing.defaultMarkupPercent ?? 0}
            onChange={(e) =>
              update({ defaultMarkupPercent: parseFloat(e.target.value) || 0 })
            }
            className="w-24 text-center"
          />
        </FieldRow>
        <FieldRow label="Currency" description="Display currency for cost estimates">
          <Select
            options={CURRENCIES}
            value={pricing.currency || "USD"}
            onChange={(e) => update({ currency: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Cost Precision" description="Decimal places shown in cost displays">
          <Input
            type="number"
            min={0}
            max={6}
            value={pricing.costPrecision ?? 4}
            onChange={(e) => update({ costPrecision: parseInt(e.target.value) || 4 })}
            className="w-20 text-center"
          />
        </FieldRow>
        <FieldRow label="Show Cost in Header" description="Display live cost estimate in the dashboard header">
          <Toggle
            checked={pricing.showHeaderCost ?? false}
            onChange={(val) => update({ showHeaderCost: val })}
          />
        </FieldRow>
      </Section>

      <Section title="Per-Model Rates" description="Manage provider and model pricing overrides">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-text-muted">
            Edit token rates for individual providers and models. Rates are stored in dollars per million tokens.
          </p>
          <Button size="sm" onClick={() => setShowModal(true)}>
            Edit Pricing
          </Button>
        </div>
      </Section>

      {showModal && (
        <PricingModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
