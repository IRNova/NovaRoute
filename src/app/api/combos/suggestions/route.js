import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";

function pickProvider(entry) {
  return entry?.provider || (entry?.rawModel ? String(entry.rawModel).split("/")[0] : null) || null;
}

function modelId(entry, key) {
  const provider = pickProvider(entry);
  const raw = entry?.rawModel || entry?.model || key.split(" (")[0];
  if (!provider) return raw;
  return raw.includes("/") ? raw : `${provider}/${raw}`;
}

// GET /api/combos/suggestions — data-driven fallback combo suggestions built
// from real 7-day usage: the busiest models spread across distinct providers.
export async function GET(request) {
  try {
    const stats = await getUsageStats("7d");
    const byModel = stats?.byModel && typeof stats.byModel === "object" ? stats.byModel : {};

    const entries = Object.entries(byModel)
      .map(([key, e]) => ({ key, requests: Number(e?.requests) || 0, entry: e }))
      .filter((e) => e.requests > 0)
      .sort((a, b) => b.requests - a.requests);

    if (entries.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Suggestion 1: resilience combo — top models across distinct providers so
    // a single provider outage falls through to the next one.
    const picked = [];
    const seenProviders = new Set();
    for (const e of entries) {
      const provider = pickProvider(e.entry);
      if (!provider || seenProviders.has(provider)) continue;
      seenProviders.add(provider);
      picked.push(modelId(e.entry, e.key));
      if (picked.length >= 3) break;
    }

    const totalRequests = entries.reduce((sum, e) => sum + e.requests, 0);
    const suggestions = [];

    if (picked.length >= 2) {
      suggestions.push({
        name: "auto-resilience",
        models: picked,
        reason: `Your ${picked.length} busiest models run on different providers. As a combo, an outage on one falls back to the next automatically.`,
        weeklyRequests: totalRequests,
      });
    }

    // Suggestion 2: high-volume pair with a cheaper/second provider as backup,
    // when one model clearly dominates traffic.
    if (entries.length >= 2 && entries[0].requests > totalRequests * 0.6) {
      const primary = modelId(entries[0].entry, entries[0].key);
      const backup = modelId(entries[1].entry, entries[1].key);
      if (!suggestions.some((s) => s.models[0] === primary)) {
        suggestions.push({
          name: "auto-primary-backup",
          models: [primary, backup],
          reason: `${entries[0].key} carries ${Math.round((entries[0].requests / totalRequests) * 100)}% of your traffic. Adding "${backup}" as fallback protects against its downtime.`,
          weeklyRequests: Math.round(entries[0].requests * 0.05),
        });
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json({ suggestions: [] });
  }
}
