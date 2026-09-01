"use client";

// One index for everything the sidebar does not have room for.
//
// The panel had 83 routes and the sidebar linked 27 of them. Around 25 real
// pages — the batch runner, the playground, webhooks, rate limits, the runtime
// and system views, resilience, memory, MCP — had no inbound link from
// anywhere: roughly four and a half thousand lines of working UI that could
// only be reached by typing the URL. Rather than grow the sidebar by 25 rows,
// they are grouped here and the sidebar gains one row.

import { useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/shared/components/Card";
import { translate } from "@/i18n/runtime";

const GROUPS = [
  {
    title: "Build & test",
    icon: "science",
    items: [
      { href: "/dashboard/playground", icon: "lab_profile", label: "Playground", desc: "Interactive chat for testing models and prompts" },
      { href: "/dashboard/batch", icon: "layers", label: "Batch Runner", desc: "Run one prompt across many models at once" },
      { href: "/dashboard/combos/playground", icon: "science", label: "Combo Playground", desc: "Try routing strategies before you ship them" },
      { href: "/dashboard/search-tools", icon: "search", label: "Search Tools", desc: "Web search, crawl and extract providers" },
      { href: "/dashboard/media-providers", icon: "perm_media", label: "Media Providers", desc: "Image, video, audio, music, and web search providers" },
    ],
  },
  {
    title: "Traffic & shaping",
    icon: "swap_horiz",
    items: [
      { href: "/dashboard/limits", icon: "speed", label: "Rate Limits", desc: "Per-user, per-model request and token limits" },
      { href: "/dashboard/webhooks", icon: "webhook", label: "Webhooks", desc: "Fire events to your own endpoints" },
      { href: "/dashboard/compression", icon: "compress", label: "Compression", desc: "External compression proxy" },
      { href: "/dashboard/pxpipe", icon: "conversion_path", label: "PXPIPE", desc: "Request transformation pipeline" },
      { href: "/dashboard/mitm", icon: "policy", label: "MITM Proxy", desc: "Enable MITM proxy for traffic inspection" },
    ],
  },
  {
    title: "Reliability",
    icon: "health_and_safety",
    items: [
      { href: "/dashboard/resilience", icon: "shield_lock", label: "System Resilience", desc: "Circuit breakers, retry logic, and fallback chain status" },
      { href: "/dashboard/chaos", icon: "bolt", label: "Chaos Testing", desc: "Resilience testing mode for provider fallback and error recovery" },
      { href: "/dashboard/runtime", icon: "memory", label: "Runtime", desc: "Runtime environment and database status" },
      { href: "/dashboard/system", icon: "dns", label: "System", desc: "Service health probe" },
    ],
  },
  {
    title: "Agent & extensions",
    icon: "extension",
    items: [
      { href: "/dashboard/memory", icon: "psychology", label: "Memory", desc: "Persistent memory with vector search" },
      { href: "/dashboard/mcp", icon: "extension", label: "MCP Servers", desc: "Manage Model Context Protocol servers" },
      { href: "/dashboard/conductor", icon: "hub", label: "Conductor", desc: "Multi-provider orchestration and routing decisions" },
      { href: "/dashboard/plugins", icon: "power", label: "Plugins", desc: "Transform module loads" },
      { href: "/dashboard/discovery", icon: "wifi_find", label: "Network Discovery", desc: "Auto-discover AI providers on your local network" },
    ],
  },
  {
    title: "Providers & economics",
    icon: "payments",
    items: [
      { href: "/dashboard/free-tiers", icon: "card_giftcard", label: "Free Tiers", desc: "Free tier details for each AI provider" },
      { href: "/dashboard/free-provider-rankings", icon: "leaderboard", label: "Free Provider Rankings", desc: "Ranked list of free-tier AI providers" },
      { href: "/dashboard/api-endpoints", icon: "api", label: "API Endpoints", desc: "All available routes and their configuration" },
    ],
  },
  {
    title: "About",
    icon: "info",
    items: [
      { href: "/dashboard/onboarding", icon: "rocket_launch", label: "Onboarding", desc: "Set up your first AI provider in a few steps." },
      { href: "/dashboard/changelog", icon: "history", label: "Changelog", desc: "Version history and release notes for NovaRoute" },
    ],
  },
];

export default function MoreClient() {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text-main">{translate("All tools")}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {translate("Everything that does not have its own place in the sidebar.")}
        </p>
      </div>

      <div className="relative">
        <span className="material-symbols-outlined pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
          search
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={translate("Search tools…")}
          className="h-10 w-full rounded-xl border border-border bg-surface ps-10 pe-3 text-sm text-text-main outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {groups.length === 0 && (
        <p className="py-10 text-center text-sm text-text-muted">{translate("Nothing matches your search.")}</p>
      )}

      {groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">{group.icon}</span>
            <h2 className="text-sm font-bold text-text-main">{translate(group.title)}</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="h-full p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined mt-0.5 text-[20px] text-text-muted">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-main">{translate(item.label)}</p>
                      <p className="mt-0.5 text-xs leading-5 text-text-muted">{translate(item.desc)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
