import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";
import { getSettings } from "@/lib/localDb";

// GET /api/dashboard/action-items — actionable warnings for the home page.
// Items carry a translation-friendly `key` + params; the UI composes text.
export async function GET() {
  try {
    const items = [];
    const now = Date.now();

    let connections = [];
    try {
      connections = await getProviderConnections();
    } catch {}

    const broken = connections.filter(
      (c) => c.isActive !== false && (c.testStatus === "error" || c.testStatus === "unavailable")
    );
    for (const c of broken.slice(0, 5)) {
      items.push({
        id: `provider-${c.id}`,
        type: "error",
        key: "Provider connection failing",
        provider: c.provider,
        label: c.name || "",
        href: "/dashboard/providers",
      });
    }

    const quotaExhausted = connections.filter((c) => {
      if (c.isActive === false) return false;
      if (c.testStatus === "expired") return true;
      const until = c.rateLimitedUntil ? new Date(c.rateLimitedUntil).getTime() : 0;
      return until > now;
    });
    for (const c of quotaExhausted.slice(0, 3)) {
      items.push({
        id: `quota-${c.id}`,
        type: "warning",
        key: "Quota or rate limit hit on",
        provider: c.provider,
        href: "/dashboard/quota",
      });
    }

    const creditPattern = /(429|insufficient|quota|credit|billing|exceeded)/i;
    const lowCredit = connections.filter((c) => {
      if (c.isActive === false) return false;
      if (!c.lastError || !creditPattern.test(c.lastError)) return false;
      // Only flag recent errors (last 3 days).
      const at = c.lastErrorAt ? new Date(c.lastErrorAt).getTime() : 0;
      return at > Date.now() - 3 * 86400000;
    });
    for (const c of lowCredit.slice(0, 3)) {
      items.push({
        id: `credit-${c.id}`,
        type: "warning",
        key: "Credit or quota errors detected on",
        provider: `${c.provider}${c.name ? ` (${c.name})` : ""}`,
        href: "/dashboard/providers",
      });
    }

    try {
      const settings = await getSettings();
      const usingDefaultPassword =
        settings && !settings.password && !process.env.INITIAL_PASSWORD && settings.requireLogin !== false;
      if (usingDefaultPassword) {
        items.push({
          id: "default-password",
          type: "warning",
          key: "Dashboard is still using a weak default password",
          href: "/dashboard/settings/security",
        });
      }
    } catch {}

    const order = { error: 0, warning: 1, info: 2 };
    items.sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ items: [], error: error.message }, { status: 200 });
  }
}
