"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CardSkeleton } from "@/shared/components/Loading";

// /dashboard/analytics was a legacy page that mixed real API data with
// hardcoded demo numbers. The real analytics experience lives at
// /dashboard/usage/analytics (also linked from the sidebar) — send
// any stale links/bookmarks there.
export default function AnalyticsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/usage/analytics");
  }, [router]);

  return (
    <div className="p-6">
      <CardSkeleton />
      <p className="mt-4 text-center text-sm text-text-muted">Redirecting to Analytics…</p>
    </div>
  );
}
