"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CardSkeleton } from "@/shared/components/Card";
import { translate } from "@/i18n/runtime";

// Costs merged into the Analytics hub (/dashboard/usage/analytics → Costs tab).
export default function CostsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/usage/analytics?tab=costs");
  }, [router]);

  return (
    <div className="p-6">
      <CardSkeleton />
      <p className="mt-4 text-center text-sm text-text-muted">{translate("Redirecting")}…</p>
    </div>
  );
}
