"use client";

// The update, shown in the panel.
//
// The sidebar used to answer "Update" by offering to copy a shell command and
// shut the server down so the operator could reinstall by hand. That is not an
// update button, it is an instruction to go and do it yourself, and it existed
// because the in-panel updater could not complete. It can now, so the button
// runs it and this shows what it is doing.

import PropTypes from "prop-types";
import { translate } from "@/i18n/runtime";

const STEP_LABELS = {
  starting: "Starting",
  backup: "Backing up",
  fetch: "Downloading the new version",
  install: "Installing dependencies",
  build: "Building",
  prune: "Cleaning up",
  restarting: "Restarting",
  done: "Done",
  error: "Failed",
};

export default function UpdateProgressPanel({ status, error, onClose, onRetry }) {
  const step = status?.step || "starting";
  const pct = typeof status?.pct === "number" ? status.pct : 0;
  const failed = step === "error" || Boolean(error);
  const done = step === "done";

  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-elevated p-6 shadow-2xl">
      <div className="flex items-center gap-3">
        <span
          className={`material-symbols-outlined text-[22px] ${
            failed ? "text-red-500" : done ? "text-emerald-500" : "text-primary animate-spin"
          }`}
        >
          {failed ? "error" : done ? "check_circle" : "progress_activity"}
        </span>
        <h2 className="text-lg font-semibold text-text-main">
          {failed ? translate("Update failed") : done ? translate("Update complete") : translate("Updating NovaRoute")}
        </h2>
      </div>

      {!failed && (
        <>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(pct, 3)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-text-muted">
            {translate(STEP_LABELS[step] || step)} {pct > 0 ? `· ${pct}%` : ""}
          </p>
        </>
      )}

      {failed && (
        <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error || status?.error}
        </p>
      )}

      {done && (
        <p className="mt-3 text-sm text-text-muted">
          {translate("The service is restarting. This page will reconnect on its own.")}
        </p>
      )}

      {!failed && !done && (
        <p className="mt-3 text-xs text-text-muted">
          {translate("You can leave this page. The update continues on the server.")}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        {failed && onRetry && (
          <button type="button" onClick={onRetry} className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-main hover:bg-surface-2">
            {translate("Try again")}
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white">
          {translate("Close")}
        </button>
      </div>
    </div>
  );
}

UpdateProgressPanel.propTypes = {
  status: PropTypes.object,
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onRetry: PropTypes.func,
};
