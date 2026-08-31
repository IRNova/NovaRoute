"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CardSkeleton } from "@/shared/components/Card";
import { translate } from "@/i18n/runtime";

// /dashboard/health was built against a rich /api/health payload that never
// existed — every card rendered "unknown". Health, metrics and alerts now live
// on /dashboard/monitoring; stale bookmarks land there.
export default function HealthRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/monitoring");
  }, [router]);

  return (
    <div className="p-6">
      <CardSkeleton />
      <p className="mt-4 text-center text-sm text-text-muted">{translate("Redirecting")}…</p>
    </div>
  );
}
