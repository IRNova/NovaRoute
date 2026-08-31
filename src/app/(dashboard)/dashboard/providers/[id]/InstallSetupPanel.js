"use client";

import PropTypes from "prop-types";
import { useCallback, useEffect, useState } from "react";
import { translate } from "@/i18n/runtime";

const STATUS_ICON = {
  ok: "check_circle",
  fail: "cancel",
  skip: "remove_circle",
  running: "progress_activity",
  pending: "radio_button_unchecked",
};

const STATUS_CLASS = {
  ok: "text-green-500",
  fail: "text-red-500",
  skip: "text-text-muted",
  running: "text-primary animate-spin",
  pending: "text-text-muted opacity-50",
};

/**
 * One-click "Install & Configure" panel for local + CLI providers.
 * Shows live status and runs the server-side playbook with a step log.
 */
export default function InstallSetupPanel({ providerId, onSetupComplete }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [resultOk, setResultOk] = useState(null);
  const [error, setError] = useState("");

  // Interactive CLI login bridge state
  const [loginSupported, setLoginSupported] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginActive, setLoginActive] = useState(false);
  const [screen, setScreen] = useState("");
  const [inputText, setInputText] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/providers/${providerId}/setup`, { cache: "no-store" });
      const data = await res.json();
      setStatus(data.supported === false ? { supported: false } : data);
    } catch {
      setStatus({ supported: false });
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const pollScreen = useCallback(async () => {
    try {
      const res = await fetch(`/api/providers/${providerId}/cli-login`, { cache: "no-store" });
      const data = await res.json();
      setLoginSupported(!!data.supported);
      setLoginActive(!!data.active);
      if (typeof data.screen === "string") setScreen(data.screen);
    } catch {
      /* transient */
    }
  }, [providerId]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (!stop && loginOpen) await pollScreen();
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(t); };
  }, [loginOpen, pollScreen]);

  const loginAction = async (action, extra = {}) => {
    setLoginBusy(true);
    try {
      const res = await fetch(`/api/providers/${providerId}/cli-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (action === "start" && !data.ok) setError(data.error || "Failed to start login");
      await pollScreen();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoginBusy(false);
    }
  };

  const submitLoginInput = async () => {
    if (!inputText.trim() || loginBusy) return;
    await loginAction("input", { text: inputText });
    setInputText("");
  };

  const runSetup = async () => {
    if (running) return;
    setRunning(true);
    setError("");
    setSteps([]);
    setResultOk(null);
    try {
      const res = await fetch(`/api/providers/${providerId}/setup`, { method: "POST" });
      const data = await res.json();
      setSteps(data.steps || []);
      setResultOk(!!data.ok);
      if (!res.ok && data.error) setError(data.error);
      await fetchStatus();
      if (data.ok && onSetupComplete) onSetupComplete();
    } catch (err) {
      setError(String(err?.message || err));
      setResultOk(false);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return null;
  if (!status?.supported) return null;

  const isCli = status.category === "cli";
  const ready = isCli ? status.installed : status.running;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="material-symbols-outlined text-primary text-2xl shrink-0">
            {isCli ? "terminal" : "dns"}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-lg">{translate("Install & Configure")}</h3>
            <p className="text-sm text-text-muted">
              {translate("Installs and configures this provider automatically - no terminal needed.")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {isCli ? (
                <>
                  <StatusBadge
                    ok={status.installed}
                    okText={`${translate("Installed")}${status.version ? ` (${status.version})` : ""}`}
                    failText={translate("Not installed")}
                  />
                  {status.installable === false && !status.installed && (
                    <span className="text-text-muted">{translate("No automatic installer - manual download required")}</span>
                  )}
                </>
              ) : (
                <>
                  <StatusBadge
                    ok={status.running}
                    okText={translate("Service running")}
                    failText={translate("Service not running")}
                  />
                  {status.baseUrl && <span className="font-mono text-text-muted break-all">{status.baseUrl}</span>}
                </>
              )}
              {status.connectionExists && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-green-600 dark:text-green-400">
                  <span className="material-symbols-outlined text-[12px]">link</span>
                  {translate("Connection ready")}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={runSetup}
          disabled={running}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={`material-symbols-outlined text-base ${running ? "animate-spin" : ""}`}>
            {running ? "progress_activity" : "download_done"}
          </span>
          {running ? translate("Setting up...") : translate("Install & Configure")}
        </button>
      </div>

      {(steps.length > 0 || error) && (
        <div className="mt-4 rounded-lg border border-border bg-surface/60 p-3">
          {error && (
            <p className="mb-2 flex items-start gap-1.5 text-xs text-red-500 break-words">
              <span className="material-symbols-outlined text-sm shrink-0">error</span>
              {error}
            </p>
          )}
          <ul className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={`${s.id}-${i}`} className="flex items-start gap-2 text-xs">
                <span className={`material-symbols-outlined text-base shrink-0 ${STATUS_CLASS[s.status] || "text-text-muted"}`}>
                  {STATUS_ICON[s.status] || "radio_button_unchecked"}
                </span>
                <span className="min-w-0">
                  <span className={`font-medium ${s.status === "fail" ? "text-red-500" : "text-text-main"}`}>{s.label}</span>
                  {s.detail && <span className="ml-1.5 text-text-muted break-all">— {s.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          {resultOk === true && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-500">
              <span className="material-symbols-outlined text-sm">task_alt</span>
              {translate("Setup completed successfully")}
            </p>
          )}
          {resultOk === false && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-500">
              <span className="material-symbols-outlined text-sm">report</span>
              {translate("Setup finished with errors - see details above")}
            </p>
          )}
        </div>
      )}

      {!ready && status.hint && (
        <div className="mt-3 flex gap-2 rounded-lg bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-400">
          <span className="material-symbols-outlined text-base shrink-0">info</span>
          <span className="break-words">{status.hint}</span>
        </div>
      )}
      {!ready && status.docsUrl && (
        <a
          href={status.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          {translate("Official download page")}
        </a>
      )}

      {isCli && loginSupported && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                <span className="material-symbols-outlined text-base">login</span>
                {translate("CLI Authentication")}
              </h4>
              <p className="mt-0.5 text-xs text-text-muted">
                {translate("Runs the provider's interactive login on the server - links and prompts appear below; paste codes back.")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {loginActive && (
                <button
                  onClick={() => loginAction("stop")}
                  disabled={loginBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-muted hover:bg-surface-2"
                >
                  <span className="material-symbols-outlined text-sm">stop_circle</span>
                  {translate("Stop session")}
                </button>
              )}
              <button
                onClick={() => {
                  if (loginOpen) { setLoginOpen(false); return; }
                  setLoginOpen(true);
                  loginAction("start");
                }}
                disabled={loginBusy}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors ${
                  loginActive ? "bg-emerald-600 hover:bg-emerald-500" : "bg-primary hover:bg-primary/90"
                }`}
              >
                <span className={`material-symbols-outlined text-sm ${loginBusy ? "animate-spin" : ""}`}>
                  {loginBusy ? "progress_activity" : loginActive ? "terminal" : "play_circle"}
                </span>
                {loginActive ? translate("Show live terminal") : translate("Start login")}
              </button>
            </div>
          </div>

          {loginOpen && (
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <pre className="max-h-80 overflow-auto bg-gray-950 p-3 text-[11px] leading-relaxed text-green-200 whitespace-pre-wrap break-all" dir="ltr">
                {screen || translate("Waiting for output...")}
              </pre>
              <div className="flex items-center gap-2 border-t border-border bg-surface p-2">
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitLoginInput(); }}
                  placeholder={translate("Paste code / answer here, then press Enter...")}
                  dir="ltr"
                  className="min-w-0 flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-xs outline-none focus:border-primary"
                />
                <button
                  onClick={submitLoginInput}
                  disabled={loginBusy || !inputText.trim()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  {translate("Send")}
                </button>
                <button
                  onClick={() => loginAction("key", { key: "Escape" })}
                  disabled={loginBusy || !loginActive}
                  title="Esc"
                  className="shrink-0 rounded-md border border-border px-2 py-1.5 text-xs text-text-muted hover:bg-surface-2"
                >
                  Esc
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ ok, okText, failText }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
        ok ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-500"
      }`}
    >
      <span className="material-symbols-outlined text-[12px]">{ok ? "check_circle" : "cancel"}</span>
      {ok ? okText : failText}
    </span>
  );
}

InstallSetupPanel.propTypes = {
  providerId: PropTypes.string.isRequired,
  onSetupComplete: PropTypes.func,
};
