"use client";

import { useState, useEffect, Suspense } from "react";
import { CardSkeleton } from "@/shared/components/Loading";
import ProviderLimits from "../usage/components/ProviderLimits";
import ModelTokenTracker from "./components/ModelTokenTracker";

export default function QuotaPage() {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (typeof data.autoRefreshProviderQuota === "boolean") {
          setAutoRefreshEnabled(data.autoRefreshProviderQuota);
        }
        if (typeof data.autoRefreshProviderQuotaInterval === "number") {
          setAutoRefreshInterval(data.autoRefreshProviderQuotaInterval);
        }
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-6 animate-in fade-in duration-300">
      <ModelTokenTracker />
      <Suspense fallback={<CardSkeleton />}>
        <ProviderLimits
          autoRefreshInterval={autoRefreshEnabled ? autoRefreshInterval : 0}
        />
      </Suspense>
    </div>
  );
}
