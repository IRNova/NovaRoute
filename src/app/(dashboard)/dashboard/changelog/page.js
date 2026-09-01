"use client";
import { useState, useEffect } from "react";
import Card, { CardSkeleton } from "@/shared/components/Card";
import Badge from "@/shared/components/Badge";
import { parseChangelog } from "@/shared/utils/parseChangelog";
import { translate } from "@/i18n/runtime";

const TYPE_STYLES = {
  feature: { bg: "bg-blue-500/10", text: "text-blue-500", label: "Feature" },
  fix: { bg: "bg-green-500/10", text: "text-green-500", label: "Fix" },
  breaking: { bg: "bg-red-500/10", text: "text-red-500", label: "Breaking" },
};

export default function ChangelogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    // The endpoint serves markdown, not JSON. Calling .json() on it always
    // threw, and the page silently rendered hardcoded sample entries instead
    // of the notes for the build actually running.
    fetch("/api/changelog", { cache: "no-store" })
      .then((r) => r.text())
      .then((md) => {
        setEntries(parseChangelog(md));
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load the changelog for this build.");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6 max-w-3xl mx-auto space-y-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-main">{translate("Changelog")}</h1>
        <p className="text-sm text-text-muted mt-1">{translate("Version history and release notes for NovaRoute")}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {translate(error)}
        </div>
      )}

      {!error && entries.length === 0 && (
        <p className="py-10 text-center text-sm text-text-muted">
          {translate("No release notes shipped with this build.")}
        </p>
      )}

      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border-subtle" />

        <div className="space-y-8">
          {entries.map((entry) => (
            <div key={entry.version} className="relative flex gap-4">
              <div className="relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface">
                <span className="text-xs font-bold text-text-main">{String(entry.version).split(".").slice(0, 2).join(".")}</span>
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
