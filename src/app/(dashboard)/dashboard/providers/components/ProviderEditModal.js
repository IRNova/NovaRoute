"use client";

import { useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Modal,
  Button,
  Badge,
  Toggle,
  Input,
  Select,
  KiroOAuthWrapper,
  CursorAuthModal,
  GitLabAuthModal,
  OAuthModal,
  IFlowCookieModal,
  ConfirmModal,
} from "@/shared/components";
import {
  OAUTH_PROVIDERS,
  FREE_PROVIDERS,
  APIKEY_PROVIDERS,
  FREE_TIER_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  CLI_PROVIDERS,
} from "@/shared/constants/providers";
import { cn } from "@/shared/utils/cn";
import { translate } from "@/i18n/runtime";
import { PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { getProviderState, isQuotaExhausted, isBroken, isConnected } from "./providerStatus";

const NONE_PROXY_POOL_VALUE = "__none__";

const STATUS_DOT = {
  connected: "bg-emerald-500",
  exhausted: "bg-red-500",
  broken: "bg-amber-500",
  unknown: "bg-neutral-400 dark:bg-neutral-500",
  disabled: "bg-neutral-200 dark:bg-neutral-700",
};

function connState(conn) {
  if (conn.isActive === false) return "disabled";
  if (isQuotaExhausted(conn)) return "exhausted";
  if (isBroken(conn)) return "broken";
  if (isConnected(conn)) return "connected";
  return "unknown";
}

function statusDotColor(state) {
  return STATUS_DOT[state] || STATUS_DOT.unknown;
}

export default function ProviderEditModal({
  isOpen,
  onClose,
  providerId,
  providerInfo,
  connections = [],
  proxyPools = [],
  isCompatible = false,
  isAnthropic = false,
  error = "",
  onSaveApiKey,
  onBulkDone,
  onUpdateConnection,
  onDeleteConnection,
  onToggleConnection,
}) {
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [showOAuth, setShowOAuth] = useState(false);
  const [showIFlow, setShowIFlow] = useState(false);
  const [deletingConnection, setDeletingConnection] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [addConnectionError, setAddConnectionError] = useState("");

  // CLI detection state
  const [cliInstalled, setCliInstalled] = useState(null);
  const [cliPath, setCliPath] = useState("");
  const [cliChecking, setCliChecking] = useState(false);

  // One-click auto-install (server-side playbook)
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupSteps, setSetupSteps] = useState([]);
  const [setupResult, setSetupResult] = useState(null);

  // Inline form state
  const [formData, setFormData] = useState({
    name: "",
    apiKey: "",
    proxyPoolId: NONE_PROXY_POOL_VALUE,
    credentialData: {},
  });
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [testPassed, setTestPassed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Models state
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelStatuses, setModelStatuses] = useState({}); // { modelId: "active" | "inactive" | "error" | "testing" }
  const [testingAllModels, setTestingAllModels] = useState(false);

  const provider = providerInfo || {};
  const hasOAuth = !!(OAUTH_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || provider.authModes?.includes("oauth"));
  const hasCookie = !!WEB_COOKIE_PROVIDERS[providerId] || provider.authType === "cookie" || provider.category === "webCookie";
  const hasCLI = !!CLI_PROVIDERS[providerId] || provider.category === "cli";
  const hasApiKey = !!(APIKEY_PROVIDERS[providerId] || FREE_TIER_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || provider.authModes?.includes("apikey") || isCompatible) && !hasCLI && !(provider.category === "local");
  const allDisabled = connections.length > 0 && connections.every((c) => c.isActive === false);
  const { label: stateLabel, state: providerState } = getProviderState(providerId, connections);
  const activeCount = connections.filter((c) => c.isActive !== false).length;
  const providerAlias = PROVIDER_ID_TO_ALIAS[providerId] || provider.alias || providerId;

  // Load cached/default models when modal opens; live extraction is manual.
  const loadCachedModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const allModels = new Map();
      const [defaultsRes, customRes, testRes, disabledRes] = await Promise.all([
        fetch("/api/providers/default-models"),
        fetch("/api/models/custom", { cache: "no-store" }),
        fetch(`/api/models/test-results?providerAlias=${encodeURIComponent(providerAlias)}`, { cache: "no-store" }),
        fetch(`/api/models/disabled?providerAlias=${encodeURIComponent(providerAlias)}`, { cache: "no-store" }),
      ]);

      if (defaultsRes.ok) {
        const data = await defaultsRes.json();
        const defaultModels = data.providers?.[providerAlias] || data.providers?.[providerId] || [];

        for (const m of defaultModels) {
          const id = m.id || m.name;
          if (!id) continue;
          allModels.set(id, {
            id,
            name: m.name || id,
            contextWindow: m.contextWindow || m.context_window || null,
            source: "default",
          });
        }
      }

      if (customRes.ok) {
        const data = await customRes.json();
        for (const m of data.models || []) {
          if (m.providerAlias !== providerAlias) continue;
          const id = m.id || m.name;
          if (!id || allModels.has(id)) continue;
          allModels.set(id, { id, name: m.name || id, contextWindow: m.contextWindow || null, source: "saved" });
        }
      }

      let disabled = new Set();
      if (disabledRes.ok) {
        const data = await disabledRes.json();
        disabled = new Set(data.ids || []);
      }

      if (testRes.ok) {
        const data = await testRes.json();
        const statuses = {};
        for (const [modelId, result] of Object.entries(data.results || {})) {
          statuses[modelId] = result?.status === "ok" ? "active" : "inactive";
        }
        setModelStatuses(statuses);
      }

      setModels([...allModels.values()].filter((m) => !disabled.has(m.id)));
      setModelsLoaded(true);
    } catch (err) {
      setModelsError(err.message || "Failed to load models");
    } finally {
      setModelsLoading(false);
    }
  }, [providerAlias, providerId]);

  const extractModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const allModels = new Map();
      for (const m of models) {
        allModels.set(m.id, m);
      }

      if (connections.length > 0) {
        for (const conn of connections) {
          if (conn.isActive === false) continue;
          try {
            const res = await fetch(`/api/providers/${conn.id}/models`, { cache: "no-store" });
            if (!res.ok) continue;
            const data = await res.json();
            for (const m of data.models || []) {
              const id = m.id || m.name;
              if (!id) continue;
              allModels.set(id, {
                id,
                name: m.name || id,
                contextWindow: m.context_window || m.contextWindow || m.contextLength || null,
                source: "live",
              });
            }
          } catch { /* skip failed connections */ }
        }
      } else {
        const res = await fetch("/api/providers/extract-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: providerId }),
        });
        if (res.ok) {
          const data = await res.json();
          // Say so when this is the built-in catalogue rather than the
          // provider's own list. Silently presenting one as the other is why
          // extracted names did not match the provider.
          if (data.static) {
            setModelsError(
              data.warning
                ? `${translate("Showing the built-in model list")}: ${data.warning}`
                : translate("The provider's live model list was unavailable, so the built-in list is shown.")
            );
          }
          for (const m of data.models || []) {
            const id = m.id || m.name;
            if (id) allModels.set(id, { id, name: m.name || id, contextWindow: m.contextWindow || null, source: data.static ? "default" : "live" });
          }
        }
      }

      const nextModels = [...allModels.values()];

      // One request for the whole catalogue. This used to fire a POST per
      // model, so a provider with 76 models opened 76 connections that the
      // browser then queued six at a time, and Promise.allSettled swallowed
      // every rejection. The list was also painted before the writes ran, so a
      // failed save showed the models and then lost them on the next refresh:
      // "they appear and then disappear". Save first, then show, and say so
      // when the save fails.
      if (nextModels.length > 0) {
        const res = await fetch("/api/models/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerAlias,
            models: nextModels.map((m) => ({ id: m.id, name: m.name || m.id, type: "llm" })),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Could not save the extracted models (HTTP ${res.status})`);
        }
      }

      setModels(nextModels);
      setModelsLoaded(true);
    } catch (err) {
      setModelsError(err.message || "Failed to extract models");
    } finally {
      setModelsLoading(false);
    }
  }, [connections, models, providerAlias, providerId]);

  // Test a single model
  const handleTestModel = async (modelId) => {
    if (connections.length === 0) return;
    setModelStatuses((prev) => ({ ...prev, [modelId]: "testing" }));
    const conn = connections.find((c) => c.isActive !== false) || connections[0];
    try {
      const res = await fetch(`/api/providers/${conn.id}/test-models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: [{ id: modelId }] }),
      });
      const data = await res.json();
      if (data.error) {
        setModelStatuses((prev) => ({ ...prev, [modelId]: "error" }));
        setModelsError(data.error);
        return;
      }
      const result = (data.results || [])[0];
      // ok === null means the test does not apply to this provider (it serves
      // speech, images, search or embeddings, not chat). That is not a failure.
      const ok = result?.ok;
      setModelStatuses((prev) => ({
        ...prev,
        [modelId]: ok === true ? "active" : ok === null || result?.skipped ? "untested" : "inactive",
      }));
      if (!ok) {
        setModels((prev) => prev.filter((m) => m.id !== modelId));
        await fetch("/api/models/disabled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerAlias, ids: [modelId] }),
        });
      }
    } catch {
      setModelStatuses((prev) => ({ ...prev, [modelId]: "error" }));
    }
  };

  // Test all models
  const handleTestAllModels = async () => {
    if (connections.length === 0 || models.length === 0) return;
    setTestingAllModels(true);
    const conn = connections.find((c) => c.isActive !== false) || connections[0];
    try {
      const res = await fetch(`/api/providers/${conn.id}/test-models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: models.map((m) => ({ id: m.id })) }),
      });
      const data = await res.json();
      if (data.error) {
        setModelsError(data.error);
        setTestingAllModels(false);
        return;
      }
      const newStatuses = {};
      for (const r of data.results || []) {
        newStatuses[r.modelId] =
          r.ok === true ? "active" : r.ok === null || r.skipped ? "untested" : "inactive";
      }
      setModelStatuses((prev) => ({ ...prev, ...newStatuses }));
      // Only genuine failures are auto-hidden. A model that could not be
      // tested must not be disabled on the strength of a test that never ran.
      const failedIds = (data.results || [])
        .filter((r) => r.ok === false && !r.skipped)
        .map((r) => r.modelId)
        .filter(Boolean);
      if (failedIds.length > 0) {
        setModels((prev) => prev.filter((m) => !failedIds.includes(m.id)));
        await fetch("/api/models/disabled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerAlias, ids: failedIds }),
        });
      }
    } catch {
      // Mark all as error
      const newStatuses = {};
      for (const m of models) {
        newStatuses[m.id] = "error";
      }
      setModelStatuses((prev) => ({ ...prev, ...newStatuses }));
    }
    setTestingAllModels(false);
  };

  // Delete a model
  const handleDeleteModel = (modelId) => {
    setModels((prev) => prev.filter((m) => m.id !== modelId));
    setModelStatuses((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  };

  // One-click auto-install: runs the same playbook as the provider detail
  // page (detect → npm install -g → verify → create connection for noAuth).
  // NOTE: must stay ABOVE the effects below — their dep arrays reference it.
  const recheckCli = useCallback(() => {
    const cliName = providerId.replace(/-cli$/, "").replace(/-agentic$/, "");
    setCliChecking(true);
    fetch(`/api/providers/cli-detect?cli=${encodeURIComponent(cliName)}`)
      .then((r) => r.json())
      .then((data) => {
        setCliInstalled(data.installed ?? false);
        setCliPath(data.path || "");
      })
      .catch(() => {})
      .finally(() => setCliChecking(false));
  }, [providerId]);

  const handleAutoInstall = async () => {
    if (setupRunning) return;
    setSetupRunning(true);
    setSetupSteps([]);
    setSetupResult(null);
    try {
      const res = await fetch(`/api/providers/${providerId}/setup`, { method: "POST" });
      const data = await res.json();
      setSetupSteps(data.steps || []);
      setSetupResult(!!data.ok);
      if (data.ok) {
        recheckCli();
        onBulkDone?.();
      }
    } catch {
      setSetupSteps([]);
      setSetupResult(false);
    } finally {
      setSetupRunning(false);
    }
  };

  useEffect(() => {
    if (!isOpen || modelsLoaded) return;
    queueMicrotask(() => loadCachedModels());
  }, [isOpen, modelsLoaded, loadCachedModels]);

  // CLI detection
  useEffect(() => {
    if (!isOpen || !hasCLI) return;
    queueMicrotask(() => recheckCli());
  }, [isOpen, hasCLI, recheckCli]);

  // Reset state when modal opens
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen && prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    setShowInlineForm(false);
    setShowOAuth(false);
    setShowIFlow(false);
    setDeletingConnection(null);
    setTestingId(null);
    setTestResults({});
    setAddConnectionError("");
    setFormData({ name: "", apiKey: "", proxyPoolId: NONE_PROXY_POOL_VALUE });
    setValidationResult(null);
    setTestPassed(false);
    setSaving(false);
    setModelsLoading(false);
    setModelsError("");
    setSetupSteps([]);
    setSetupResult(null);
  }

  const handleValidate = async () => {
    const { apiKey } = buildCredentialPayload();
    if (!apiKey) return;
    setValidating(true);
    setValidationResult(null);
    setTestPassed(false);
    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          apiKey,
        }),
      });
      const data = await res.json();
      const valid = !!data.valid;
      setValidationResult(valid ? "success" : "failed");
      setTestPassed(valid);
    } catch {
      setValidationResult("failed");
      setTestPassed(false);
    } finally {
      setValidating(false);
    }
  };

  const handleSaveInline = async () => {
    const { apiKey, credentialData } = buildCredentialPayload();
    if (!apiKey || saving) return;
    setSaving(true);
    setAddConnectionError("");
    try {
      await onSaveApiKey({
        name: formData.name || provider.name || providerId,
        apiKey,
        proxyPoolId: formData.proxyPoolId === NONE_PROXY_POOL_VALUE ? null : formData.proxyPoolId,
        testStatus: testPassed ? "active" : "unknown",
        authType: isCookie ? "cookie" : undefined,
        ...(credentialData ? { providerSpecificData: credentialData } : {}),
      });
      setShowInlineForm(false);
      setFormData({ name: "", apiKey: "", proxyPoolId: NONE_PROXY_POOL_VALUE, credentialData: {} });
      setValidationResult(null);
      setTestPassed(false);
    } catch (err) {
      setAddConnectionError(err?.message || "Failed to save connection");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (conn) => {
    setTestingId(conn.id);
    try {
      const res = await fetch(`/api/providers/${conn.id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [conn.id]: data.valid ? "success" : "failed" }));
      onBulkDone?.();
    } catch {
      setTestResults((prev) => ({ ...prev, [conn.id]: "failed" }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingConnection) return;
    try {
      await onDeleteConnection(deletingConnection.id);
      setDeletingConnection(null);
    } catch {
      setDeletingConnection(null);
    }
  };

  const handleOAuthSuccess = () => {
    setShowOAuth(false);
    onBulkDone?.();
  };

  const isIflow = providerId === "iflow";
  const isCookie = hasCookie;
  const websiteUrl = provider.website || provider.notice?.apiKeyUrl || null;
  const credentialFields = provider.credentialFields || null;

  // Build credentialData from form state and combine required fields into apiKey for backward compat
  const buildCredentialPayload = () => {
    if (!credentialFields) return { apiKey: formData.apiKey, credentialData: undefined };
    const data = { ...formData.credentialData };
    const requiredFields = credentialFields.filter((f) => f.required);
    // Cookie providers: build a real Cookie header ("name=value; …") so
    // multi-cookie sessions authenticate correctly.
    const isCookieCreds = isCookie || provider.authType === "cookie";
    let apiKey;
    if (isCookieCreds) {
      apiKey = requiredFields
        .map((f) => ({ id: f.id, v: String(data[f.id] || "").trim() }))
        .filter(({ v }) => v)
        .map(({ id, v }) => (v.includes("=") ? v : `${id}=${v}`))
        .join("; ");
    } else {
      apiKey = requiredFields.map((f) => data[f.id] || "").join(" ");
    }
    return { apiKey: apiKey.trim(), credentialData: Object.keys(data).length > 0 ? data : undefined };
  };

  return (
    <Modal isOpen={isOpen} title={`${provider.name || providerId}`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">

        {/* Status Bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <span
            className={cn("size-3 shrink-0 rounded-full", statusDotColor(providerState))}
            aria-hidden="true"
          />
          <span className="text-sm font-semibold capitalize text-text-main">{stateLabel}</span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted">
            {activeCount} {translate("active")} / {connections.length} {translate("connections")}
          </span>
          {models.length > 0 && (
            <>
              <span className="text-xs text-text-muted">·</span>
              <span className="text-xs text-text-muted">{models.length} {translate("models")}</span>
            </>
          )}
          {allDisabled && (
            <Badge variant="warning" size="sm">{translate("Disabled")}</Badge>
          )}
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-auto p-1.5 rounded-lg text-text-muted hover:bg-surface-2 hover:text-primary transition-colors"
              title={translate("Open website")}
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          )}
        </div>

        {allDisabled && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined text-[16px]">toggle_off</span>
            {translate("This provider is disabled — its models are hidden and it will not receive requests.")}
          </div>
        )}
        {error && <div className="text-sm text-red-500">{error}</div>}
        {addConnectionError && <div className="text-sm text-red-500">{addConnectionError}</div>}

        {/* CLI Detection Section */}
        {hasCLI && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[16px] text-text-muted">terminal</span>
              <h3 className="text-sm font-semibold">{translate("CLI Status")}</h3>
            </div>
            {cliChecking ? (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                {translate("Checking CLI installation...")}
              </div>
            ) : cliInstalled ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {translate("CLI detected at:")} <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">{cliPath}</code>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  {translate("CLI not found. Install it to use this provider.")}
                </div>
                {provider.display?.notice?.text && (
                  <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-text-muted">
                    <code className="whitespace-pre-wrap text-[11px]">{provider.display.notice.text}</code>
                  </div>
                )}
                <div>
                  <Button size="sm" onClick={handleAutoInstall} disabled={setupRunning} loading={setupRunning}>
                    <span className={cn("material-symbols-outlined text-[14px]", setupRunning && "animate-spin")}>
                      {setupRunning ? "progress_activity" : "download_done"}
                    </span>
                    {setupRunning ? translate("Setting up...") : translate("Install & Configure")}
                  </Button>
                  <span className="ms-2 align-middle text-[11px] text-text-muted">
                    {translate("Installs and configures this provider automatically - no terminal needed.")}
                  </span>
                </div>
                {(setupSteps.length > 0 || setupResult === false) && (
                  <ul className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2/60 p-2">
                    {setupSteps.map((s, i) => (
                      <li key={`${s.id}-${i}`} className="flex items-start gap-1.5">
                        <span
                          className={cn(
                            "material-symbols-outlined shrink-0 text-[13px]",
                            s.status === "ok" ? "text-emerald-500" : s.status === "fail" ? "text-red-500" : s.status === "running" ? "text-primary animate-spin" : "text-text-muted"
                          )}
                        >
                          {s.status === "ok" ? "check_circle" : s.status === "fail" ? "cancel" : s.status === "skip" ? "remove_circle" : s.status === "running" ? "progress_activity" : "radio_button_unchecked"}
                        </span>
                        <span className="min-w-0 break-words">
                          <span className={cn("font-medium", s.status === "fail" ? "text-red-500" : "text-text-main")}>{s.label}</span>
                          {s.detail && <span className="text-text-muted"> — {s.detail}</span>}
                        </span>
                      </li>
                    ))}
                    {setupResult === true && (
                      <li className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="material-symbols-outlined text-[13px]">task_alt</span>
                        {translate("Setup completed successfully")}
                      </li>
                    )}
                    {setupResult === false && (
                      <li className="flex items-center gap-1.5 font-medium text-red-500">
                        <span className="material-symbols-outlined text-[13px]">report</span>
                        {translate("Setup finished with errors - see details above")}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Connections List */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-text-muted">key</span>
            <h3 className="text-sm font-semibold">{translate("API Keys")}</h3>
            {connections.length > 0 && (
              <span className="text-xs text-text-muted">· {connections.length}</span>
            )}
          </div>

          {connections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
              <span className="material-symbols-outlined text-[32px] text-text-muted">link_off</span>
              <p className="text-sm text-text-muted">{translate("No connection yet. Add one above.")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {connections.map((conn) => {
                const state = connState(conn);
                return (
                  <div
                    key={conn.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn("size-2.5 shrink-0 rounded-full", statusDotColor(state))}
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm font-semibold text-text-main">
                          {conn.name || `${provider.name} #${conn.priority || "?"}`}
                        </span>
                        <Badge variant="default" size="sm">
                          {conn.authType === "oauth" ? "OAuth" : conn.authType === "cookie" ? "Cookie" : "API Key"}
                        </Badge>
                      </div>
                      <div className="shrink-0">
                        <Toggle
                          size="sm"
                          checked={conn.isActive !== false}
                          onChange={(next) => onToggleConnection(conn.id, next)}
                          aria-label={conn.isActive === false ? "Enable connection" : "Disable connection"}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="capitalize text-text-muted">{stateLabel}</span>
                      {conn.authType === "oauth" && conn.email && (
                        <span className="text-text-muted">· {conn.email}</span>
                      )}
                      {conn.priority > 1 && <span className="text-text-muted">· priority {conn.priority}</span>}
                    </div>
                    {(state === "broken" || state === "exhausted") && conn.lastError && (
                      <p className="break-words rounded-md bg-red-500/5 px-2 py-1.5 text-xs text-red-600 dark:text-red-400">
                        {conn.lastError}
                        {conn.lastErrorAt ? ` · ${new Date(conn.lastErrorAt).toLocaleString()}` : ""}
                      </p>
                    )}
                    {testResults[conn.id] && (
                      <p className={cn("text-xs", testResults[conn.id] === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                        {testResults[conn.id] === "success" ? "Test passed" : "Test failed"}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTest(conn)}
                        disabled={testingId === conn.id}
                      >
                        <span className={cn("material-symbols-outlined text-[14px]", testingId === conn.id && "animate-spin")}>
                          {testingId === conn.id ? "progress_activity" : "play_arrow"}
                        </span>
                        {testingId === conn.id ? "Testing" : translate("Test")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => setDeletingConnection(conn)}
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        {translate("Delete")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Inline API Key Form */}
        {showInlineForm && (hasApiKey || hasCookie) && !isIflow && (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-text-muted">
                {isCookie ? "cookie" : "key"}
              </span>
              <h3 className="text-sm font-semibold">
                {isCookie ? translate("Add Cookie") : translate("Add API Key")}
              </h3>
            </div>

            {addConnectionError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {addConnectionError}
              </div>
            )}

            <Input
              label={translate("Name")}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={provider.name || providerId}
            />

            <div className="flex flex-col gap-2">
              {credentialFields ? (
                credentialFields.map((field) => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-text-muted">
                      {field.label}
                      {field.required && <span className="text-red-500 ms-1">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono resize-y min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={field.placeholder || ""}
                        value={formData.credentialData[field.id] || ""}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            credentialData: { ...formData.credentialData, [field.id]: e.target.value },
                          });
                          setTestPassed(false);
                          setValidationResult(null);
                        }}
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={formData.credentialData[field.id] || ""}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            credentialData: { ...formData.credentialData, [field.id]: e.target.value },
                          });
                          setTestPassed(false);
                          setValidationResult(null);
                        }}
                        type={isCookie ? "text" : "password"}
                        placeholder={field.placeholder || ""}
                      />
                    )}
                    {field.hint && (
                      <p className="text-[11px] text-teal-600 dark:text-teal-400">{field.hint}</p>
                    )}
                  </div>
                ))
              ) : (
                <Input
                  label={isCookie ? translate("Cookie Value") : translate("API Key")}
                  value={formData.apiKey}
                  onChange={(e) => {
                    setFormData({ ...formData, apiKey: e.target.value });
                    setTestPassed(false);
                    setValidationResult(null);
                  }}
                  type="password"
                />
              )}
              {isCookie && !credentialFields && (provider.cookieHint || provider.authHint) && (
                <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2.5 text-xs text-teal-700 dark:text-teal-300">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5">info</span>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{translate("How to get the cookie:")}</span>
                      <span>{provider.cookieHint || provider.authHint}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleValidate}
                  disabled={validating || (credentialFields ? credentialFields.filter(f=>f.required).some(f => !formData.credentialData[f.id]) : !formData.apiKey)}
                  loading={validating}
                >
                  {validating ? translate("Testing...") : testPassed ? translate("Connection verified") : translate("Test Connection")}
                </Button>
                {validationResult === "success" && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    {translate("Connection verified")}
                  </span>
                )}
                {validationResult === "failed" && (
                  <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {translate("Connection failed")}
                  </span>
                )}
              </div>
            </div>

            {proxyPools && proxyPools.length > 0 && (
              <Select
                label={translate("Proxy Pool")}
                value={formData.proxyPoolId}
                onChange={(e) => setFormData({ ...formData, proxyPoolId: e.target.value })}
                options={[
                  { value: NONE_PROXY_POOL_VALUE, label: translate("None") },
                  ...proxyPools.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            )}

            <div className="flex gap-2">
              <Button onClick={handleSaveInline} disabled={!testPassed || saving} loading={saving}>
                {translate("Save")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowInlineForm(false);
                  setFormData({ name: "", apiKey: "", proxyPoolId: NONE_PROXY_POOL_VALUE, credentialData: {} });
                  setValidationResult(null);
                  setTestPassed(false);
                  setAddConnectionError("");
                }}
              >
                {translate("Cancel")}
              </Button>
            </div>
          </section>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {isIflow ? (
            <Button
              onClick={() => {
                setAddConnectionError("");
                setShowIFlow(true);
              }}
            >
              <span className="material-symbols-outlined text-[16px]">link</span>
              Connect with Cookie
            </Button>
          ) : (
            <>
              {hasCookie && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAddConnectionError("");
                    setShowInlineForm(true);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">cookie</span>
                  Add Cookie
                </Button>
              )}
              {hasApiKey && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAddConnectionError("");
                    setShowInlineForm(true);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">key</span>
                  {translate("API Keys")}
                </Button>
              )}
              {hasOAuth && (
                <Button
                  onClick={() => {
                    setAddConnectionError("");
                    setShowOAuth(true);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">login</span>
                  {providerId === "kiro"
                    ? translate("Connect Kiro")
                    : providerId === "cursor"
                      ? translate("Connect Cursor")
                      : translate("Sign in with OAuth")}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Models Section */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-text-muted">view_module</span>
            <h3 className="text-sm font-semibold">{translate("Models")}</h3>
            {models.length > 0 && (
              <span className="text-xs text-text-muted">· {models.length}</span>
            )}
            <div className="ms-auto flex items-center gap-1">
              {connections.length > 0 && models.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleTestAllModels}
                  disabled={testingAllModels}
                >
                  <span className={cn("material-symbols-outlined text-[14px]", testingAllModels && "animate-spin")}>
                    {testingAllModels ? "progress_activity" : "play_arrow"}
                  </span>
                  {testingAllModels ? translate("Testing...") : translate("Test All")}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setModelsLoaded(false); setModelStatuses({}); extractModels(); }}
                disabled={modelsLoading}
              >
                <span className={cn("material-symbols-outlined text-[14px]", modelsLoading && "animate-spin")}>
                  {modelsLoading ? "progress_activity" : "refresh"}
                </span>
                {modelsLoading ? translate("Extracting...") : translate("Extract All")}
              </Button>
            </div>
          </div>

          {modelsLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-6 text-xs text-text-muted">
              <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
              {translate("Extracting models...")}
            </div>
          ) : models.length === 0 && modelsError ? (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface py-6 text-center text-xs text-red-500">
              <span className="material-symbols-outlined text-[24px]">error</span>
              {modelsError}
            </div>
          ) : models.length > 0 ? (
            <div className="flex max-h-[300px] flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-surface p-2">
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-text-muted">
                <span></span>
                <span>{translate("Model")}</span>
                <span className="text-right">{translate("Context")}</span>
                <span></span>
              </div>
              {models.map((m) => {
                const status = modelStatuses[m.id];
                const statusColor = status === "active" ? "text-green-500" : status === "inactive" ? "text-orange-500" : status === "error" ? "text-red-500" : status === "testing" ? "text-blue-500 animate-spin" : "text-text-muted";
                const statusIcon = status === "active" ? "check_circle" : status === "inactive" ? "cancel" : status === "error" ? "error" : status === "testing" ? "progress_activity" : "radio_button_unchecked";
                
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 hover:bg-surface-2/40 transition-colors"
                  >
                    <button
                      onClick={() => handleTestModel(m.id)}
                      disabled={connections.length === 0 || status === "testing"}
                      className="p-0.5 rounded hover:bg-surface-2 transition-colors"
                      title={connections.length === 0 ? translate("Add a connection first") : translate("Test")}
                    >
                      <span className={cn("material-symbols-outlined text-[16px]", statusColor)}>{statusIcon}</span>
                    </button>
                    <div className="min-w-0">
                      <span className="truncate font-mono text-xs text-text-main">{m.id}</span>
                      {m.source === "default" && !status && (
                        <span className="text-[10px] text-text-muted ms-1">({translate("default")})</span>
                      )}
                    </div>
                    <span className="shrink-0 text-right text-[11px] text-text-muted">
                      {m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : "—"}
                    </span>
                    <button
                      onClick={() => handleDeleteModel(m.id)}
                      className="p-0.5 rounded text-text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      title={translate("Delete")}
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface py-6 text-center text-xs text-text-muted">
              <span className="material-symbols-outlined text-[24px]">data_object</span>
              {translate("No models available")}
            </div>
          )}
          
          {models.length > 0 && modelsError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500 break-words">
              {modelsError}
            </p>
          )}

          {/* Status summary */}
          {models.length > 0 && Object.keys(modelStatuses).length > 0 && (
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-green-500">check_circle</span>
                {Object.values(modelStatuses).filter((s) => s === "active").length} {translate("active")}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-orange-500">cancel</span>
                {Object.values(modelStatuses).filter((s) => s === "inactive").length} {translate("inactive")}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-red-500">error</span>
                {Object.values(modelStatuses).filter((s) => s === "error").length} {translate("error")}
              </span>
            </div>
          )}
        </section>
      </div>

      {/* OAuth Modals */}
      {providerId === "iflow" && (
        <IFlowCookieModal
          isOpen={showIFlow}
          onSuccess={() => {
            setShowIFlow(false);
            onBulkDone?.();
          }}
          onClose={() => setShowIFlow(false)}
        />
      )}

      {providerId === "kiro" ? (
        <KiroOAuthWrapper
          isOpen={showOAuth}
          providerInfo={provider}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuth(false)}
        />
      ) : providerId === "cursor" ? (
        <CursorAuthModal
          isOpen={showOAuth}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuth(false)}
        />
      ) : providerId === "gitlab" ? (
        <GitLabAuthModal
          isOpen={showOAuth}
          providerInfo={provider}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuth(false)}
        />
      ) : (
        <OAuthModal
          isOpen={showOAuth}
          provider={providerId}
          providerInfo={provider}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuth(false)}
        />
      )}

      <ConfirmModal
        isOpen={!!deletingConnection}
        title="Delete connection"
        message={`Remove the ${deletingConnection?.name || provider.name} connection? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeletingConnection(null)}
      />
    </Modal>
  );
}

ProviderEditModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  providerId: PropTypes.string.isRequired,
  providerInfo: PropTypes.object,
  connections: PropTypes.array,
  proxyPools: PropTypes.array,
  isCompatible: PropTypes.bool,
  isAnthropic: PropTypes.bool,
  error: PropTypes.string,
  onSaveApiKey: PropTypes.func,
  onBulkDone: PropTypes.func,
  onUpdateConnection: PropTypes.func,
  onDeleteConnection: PropTypes.func,
  onToggleConnection: PropTypes.func,
};
