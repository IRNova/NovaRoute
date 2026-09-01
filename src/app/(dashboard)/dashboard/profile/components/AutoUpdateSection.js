"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Badge from "@/shared/components/Badge";
import { translate } from "@/i18n/runtime";

const STEP_LABELS = {
  starting: "starting",
  download: "Downloading release",
  backup: "Backing up current version",
  extract: "Extracting update",
  install: "Installing dependencies",
  build: "Building new version",
  restarting: "Restarting service",
  done: "Update complete",
  error: "Update failed",
};

const STEP_ORDER = ["backup", "fetch", "install", "build", "prune", "restarting"];

export default function AutoUpdateSection() {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null); // GET /api/github-update payload
  const [checkError, setCheckError] = useState("");
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState(null); // GET /api/github-update/status payload
  const [notesOpen, setNotesOpen] = useState(false);
  const pollRef = useRef(null);

  const check = useCallback(async () => {
    setChecking(true);
    setCheckError("");
    try {
      const res = await fetch("/api/github-update", { cache: "no-store" });
      const data = await res.json();
      if (data.error && !data.latestVersion) setCheckError(data.error);
      setCheckResult(data);
    } catch {
      setCheckError(translate("Could not reach the update server"));
    } finally {
      setChecking(false);
    }
  }, []);

  // On mount: check once, and resume tracking if an update was already running.
  useEffect(() => {
    check();
    fetch("/api/github-update/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        if (s && !s.idle && !s.done && s.step !== "error") {
          setStatus(s);
          setInstalling(true);
        }
      })
      .catch(() => {});
  }, [check]);

  // Progress polling while installing.
  useEffect(() => {
    if (!installing) return undefined;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/github-update/status", { cache: "no-store" });
        const s = await res.json();
        if (!s || s.idle) return;
        setStatus(s);
        if (s.done) {
          setInstalling(false);
          clearInterval(pollRef.current);
        }
      } catch { /* transient */ }
    }, 2500);
    return () => clearInterval(pollRef.current);
  }, [installing]);

  const handleInstall = async () => {
    if (!checkResult?.hasUpdate) return;
    // Branch channel has no tag; an empty body tells the updater to take the
    // tracked branch. Requiring a tagName here is what made this button inert
    // on a repository with no releases.
    const tag = checkResult.tagName || "";
    try {
      const res = await fetch("/api/github-update/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tag ? { tag } : {}),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCheckError(data.error || translate("Failed to start the update"));
        return;
      }
      setInstalling(true);
      setStatus({ tag: tag || null, step: "starting", pct: 1, done: false, log: [] });
    } catch {
      setCheckError(translate("Failed to start the update"));
    }
  };

  // A branch build has no semantic version, so "v<sha>" would be a lie.
  const verLabel = (v) => (checkResult?.channel === "branch" ? String(v || "") : `v${v}`);

  const pct = status?.pct ?? 0;
  const currentStep = status?.step || "";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">system_update_alt</span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-main">{translate("Automatic Updates")}</h2>
              <p className="text-sm text-text-muted mt-0.5">
                {translate("Checks GitHub releases of this project and updates the server in place.")}
              </p>
            </div>
          </div>
          {checkResult?.currentVersion && (
            <Badge variant="primary" size="sm">
              {translate("Current version")}: v{checkResult.currentVersion}
            </Badge>
          )}
        </div>

        <div className="mt-5">
          {/* Idle / checking */}
          {checking && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              {translate("Checking GitHub for a newer version…")}
            </div>
          )}

          {!checking && checkError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {checkError}
              <Button size="sm" variant="ghost" className="ms-2" onClick={check}>{translate("Retry")}</Button>
            </div>
          )}

          {!checking && !checkError && checkResult?.hasUpdate === false && (
            <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm text-green-600 dark:text-green-400">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {translate("You are on the latest version.")}
              {checkResult.latestVersion && (
                <span className="text-text-muted">({translate("Latest")}: {verLabel(checkResult.latestVersion)})</span>
              )}
            </div>
          )}

          {!checking && !checkError && checkResult?.hasUpdate === true && !installing && status?.step !== "done" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">upgrade</span>
                <span className="font-semibold text-text-main">
                  {translate("New version available")}: {verLabel(checkResult.latestVersion)}
                </span>
                {checkResult.publishedAt && (
                  <span className="text-xs text-text-muted">
                    {new Date(checkResult.publishedAt).toLocaleDateString()}
                  </span>
                )}
                <a href={checkResult.releaseUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline ms-auto">
                  {translate("Release notes on GitHub")}
                </a>
              </div>

              {checkResult.releaseNotes && (
                <div>
                  <button
                    type="button"
                    onClick={() => setNotesOpen((v) => !v)}
                    className="text-xs font-medium text-text-muted hover:text-text-main"
                  >
                    {notesOpen ? translate("Hide release notes") : translate("Show release notes")}
                  </button>
                  {notesOpen && (
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs text-text-muted custom-scrollbar">
                      {checkResult.releaseNotes}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button icon="rocket_launch" onClick={handleInstall}>
                  {translate("Install update automatically")}
                </Button>
                <span className="text-xs text-text-muted">{translate("(downloads, builds and restarts the service — takes a few minutes)")}</span>
              </div>
            </div>
          )}

          {/* Installing / result */}
          {(installing || status) && (
            <div className="rounded-xl border border-border bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-text-main">
                  {status?.done
                    ? translate("Update installed successfully.")
                    : status?.error
                      ? translate("Update failed")
                      : translate("Updating to")}{" "}
                  {!status?.done && !status?.error && status?.tag && <code className="font-mono text-primary">{status.tag}</code>}
                </span>
                {!installing && status?.done && (
                  <Button size="sm" variant="secondary" icon="refresh" onClick={() => globalThis.location.reload()}>
                    {translate("Reload dashboard")}
                  </Button>
                )}
              </div>

              {status?.error && (
                <p className="text-sm text-red-600 dark:text-red-400">{status.error}</p>
              )}

              {/* Step checklist */}
              <ol className="space-y-1.5 text-sm">
                {STEP_ORDER.map((key) => {
                  const idx = STEP_ORDER.indexOf(key);
                  const curIdx = STEP_ORDER.indexOf(currentStep);
                  const state = status?.done ? "done" : curIdx > idx ? "done" : curIdx === idx ? "active" : "pending";
                  return (
                    <li key={key} className={`flex items-center gap-2 ${state === "pending" ? "text-text-muted/60" : "text-text-main"}`}>
                      <span className={`material-symbols-outlined text-[16px] ${state === "done" ? "text-green-500" : state === "active" ? "text-primary animate-pulse" : ""}`}>
                        {state === "done" ? "check_circle" : state === "active" ? "radio_button_checked" : "radio_button_unchecked"}
                      </span>
                      {translate(STEP_LABELS[key])}
                    </li>
                  );
                })}
              </ol>

              {/* Progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${status?.error ? "bg-red-500" : "bg-gradient-to-r from-primary to-success"}`}
                  style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                />
              </div>

              {/* Log tail */}
              {Array.isArray(status?.log) && status.log.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-text-muted hover:text-text-main">{translate("Technical log")}</summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/50 p-3 font-mono text-text-muted custom-scrollbar">
                    {status.log.join("\n")}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Re-check */}
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" variant="ghost" icon="refresh" onClick={check} disabled={checking || installing}>
              {translate("Check for updates")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
