"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";

const SAMPLE_CHANGELOG = [
  {
    version: "1.4.0",
    date: "2026-08-15",
    changes: [
      { type: "feature", text: "ACP agent support with Agent Communication Protocol" },
      { type: "feature", text: "Omni skills framework for built-in agent capabilities" },
      { type: "feature", text: "Webhook management with event subscriptions and testing" },
      { type: "fix", text: "Fixed token refresh race condition for Cursor OAuth" },
      { type: "fix", text: "Resolved SSE stream cutoff on provider failover" },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-08-01",
    changes: [
      { type: "feature", text: "CLI agents marketplace with install/uninstall support" },
      { type: "feature", text: "Relay proxy configuration for request forwarding" },
      { type: "feature", text: "Agent skills marketplace with ratings and install counts" },
      { type: "breaking", text: "Migrated from db.json to SQLite persistence layer" },
      { type: "fix", text: "Fixed Kiro protobuf decoding for thinking blocks" },
      { type: "fix", text: "Improved error messages for expired OAuth tokens" },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-15",
    changes: [
      { type: "feature", text: "Cloud agents panel for Jules, Devin, Codex, and more" },
      { type: "feature", text: "Token saver (RTK) for compressing tool_result content" },
      { type: "feature", text: "Batch import for proxy pools" },
      { type: "fix", text: "Fixed Gemini response translation for function calls" },
      { type: "fix", text: "Fixed quota tracking for multi-account fallback" },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-01",
    changes: [
      { type: "feature", text: "MCP server integration with tool discovery" },
      { type: "feature", text: "Proxy pool health checking and bulk operations" },
      { type: "feature", text: "Vercel/Cloudflare/Deno relay deployment" },
      { type: "breaking", text: "Restructured provider registry to auto-generated imports" },
      { type: "fix", text: "Fixed SSE keep-alive timeout for long-running requests" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-06-15",
    changes: [
      { type: "feature", text: "Initial release of NovaRoute" },
      { type: "feature", text: "OpenAI-compatible /v1 API endpoint" },
      { type: "feature", text: "40+ upstream provider support with format translation" },
      { type: "feature", text: "Model combo fallback and multi-account failover" },
      { type: "feature", text: "OAuth and API-key credential management" },
      { type: "feature", text: "Next.js dashboard with dark theme" },
      { type: "feature", text: "SQLite-based usage tracking and logging" },
    ],
  },
];

const TYPE_STYLES = {
  feature: { bg: "bg-blue-500/10", text: "text-blue-500", label: "Feature" },
  fix: { bg: "bg-green-500/10", text: "text-green-500", label: "Fix" },
  breaking: { bg: "bg-red-500/10", text: "text-red-500", label: "Breaking" },
};

export default function ChangelogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/changelog")
      .then((r) => r.json())
      .then((d) => { setEntries(d.entries || SAMPLE_CHANGELOG); setLoading(false); })
      .catch(() => { setEntries(SAMPLE_CHANGELOG); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 max-w-3xl mx-auto space-y-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">Changelog</h1>
        <p className="text-sm text-text-muted mt-1">Version history and release notes for NovaRoute</p>
      </div>

      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border-subtle" />

        <div className="space-y-8">
          {entries.map((entry) => (
            <div key={entry.version} className="relative flex gap-4">
              <div className="relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface">
                <span className="text-xs font-bold text-text-main">{entry.version.split(".").slice(0, 2).join(".")}</span>
              </div>

              <Card className="flex-1 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-lg font-bold text-text-main">v{entry.version}</h2>
                  <Badge variant="default" size="sm">{entry.date}</Badge>
                </div>
                <ul className="space-y-2">
                  {entry.changes.map((change, i) => {
                    const style = TYPE_STYLES[change.type] || TYPE_STYLES.feature;
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-sm text-text-main">{change.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
