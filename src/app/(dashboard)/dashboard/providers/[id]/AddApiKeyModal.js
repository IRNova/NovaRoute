"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Button, Badge, Input, Modal, Select } from "@/shared/components";
import { AI_PROVIDERS, getProviderAlias } from "@/shared/constants/providers";
import { planBulkAdd } from "@/shared/utils/bulkAdd";
import { cn } from "@/shared/utils/cn";

const BULK_PLACEHOLDER = `name1|sk-key1\nname2|sk-key2\nsk-key-only-auto-named`;

export default function AddApiKeyModal({ isOpen, provider, providerName, isCompatible, isAnthropic, authType, authHint, cookieHint, website, baseUrl, proxyPools, error, existingNames, credentialFields, onSave, onBulkDone, onClose }) {
  const NONE_PROXY_POOL_VALUE = "__none__";
  const isOllamaLocal = provider === "ollama-local";
  const isCookie = authType === "cookie";
  const isXaiApiKey = provider === "xai" && !isCookie;
  const credentialLabel = credentialFields ? "Credentials" : isCookie ? "Cookie Value" : provider === "qoder" ? "Personal Access Token (PAT)" : "API Key";
  const credentialPlaceholder = isCookie
    ? (provider === "grok-web" ? "sso=xxxxx... or just the raw value" : "eyJhbGciOi...")
    : (isXaiApiKey ? "xai-..." : provider === "qoder" ? "pt-..." : "");

  const isAzure = provider === "azure";
  const isCloudflareAi = provider === "cloudflare-ai";
  const providerRegions = AI_PROVIDERS?.[provider]?.regions || null;
  const defaultRegion = AI_PROVIDERS?.[provider]?.defaultRegion || providerRegions?.[0]?.id || "";

  const [formData, setFormData] = useState({
    name: "",
    apiKey: "",
    defaultModel: "",
    priority: 1,
    proxyPoolId: NONE_PROXY_POOL_VALUE,
    ollamaHostUrl: "",
    credentialData: {},
  });
  const [azureData, setAzureData] = useState({
    azureEndpoint: "",
    apiVersion: "2024-10-01-preview",
    deployment: "",
    organization: "",
  });
  const [cloudflareData, setCloudflareData] = useState({ accountId: "" });
  const [region, setRegion] = useState(defaultRegion);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [validateError, setValidateError] = useState("");
  const [testPassed, setTestPassed] = useState(false);
  const [saving, setSaving] = useState(false);
  const bulkPlaceholder = isCloudflareAi
    ? `name1|sk-key1|acc123456\nname2|sk-key2|def789012\nsk-key-only-auto-named`
    : provider === "qoder"
      ? `name1|pt-xxxxx\nname2|pt-yyyyy\npt-only-auto-named`
      : BULK_PLACEHOLDER;

  const [mode, setMode] = useState("single"); // "single" | "bulk"
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState(null); // { success, failed }

  // Model extraction / testing
  const [models, setModels] = useState([]); // [{ id, name }]
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractNote, setExtractNote] = useState("");

  // Auto-extract on open for non-compatible providers so the user sees models
  // immediately, even before entering credentials. Public endpoints are tried
  // first; credentials are only required for authenticated model lists.
  useEffect(() => {
    if (!isOpen || isCompatible || isCookie || credentialFields) return;
    let cancelled = false;
    (async () => {
      setExtracting(true);
      setExtractError("");
      setExtractNote("");
      try {
        const res = await fetch("/api/providers/extract-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey: formData.apiKey || undefined, providerSpecificData: buildProviderSpecificData() }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          const list = data.models || [];
          setModels(list);
          if (data.static) {
            setExtractNote("Live models endpoint unavailable — showing the built-in catalog.");
          } else if (!list.length) {
            setExtractNote("No models found for this provider.");
          } else {
            setExtractNote(`Loaded ${list.length} models. Test each one or run Test All to remove broken ones.`);
          }
        }
      } catch (err) {
        if (!cancelled) setExtractError(err.message || "Failed to extract models");
      } finally {
        if (!cancelled) setExtracting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, provider, isCompatible, isCookie]);
  const [testingAll, setTestingAll] = useState(false);
  const [testingModelId, setTestingModelId] = useState(null);
  const [modelStatus, setModelStatus] = useState({}); // id -> { ok, error, latencyMs }

  const buildProviderSpecificData = () => {
    if (isOllamaLocal && formData.ollamaHostUrl.trim()) {
      return { baseUrl: formData.ollamaHostUrl.trim() };
    }
    if (isAzure) {
      return {
        azureEndpoint: azureData.azureEndpoint,
        apiVersion: azureData.apiVersion,
        deployment: azureData.deployment,
        organization: azureData.organization,
      };
    }
    if (isCloudflareAi) {
      return { accountId: cloudflareData.accountId };
    }
    if (isCompatible && baseUrl) {
      return { baseUrl };
    }
    if (providerRegions && region) {
      return { region };
    }
    return undefined;
  };

  // Build credential payload from credentialFields (multi-field) or single apiKey
  const buildCredentialPayload = () => {
    if (!credentialFields) return { apiKey: formData.apiKey, credentialData: undefined };
    const data = { ...formData.credentialData };
    const requiredFields = credentialFields.filter((f) => f.required);
    // Cookie providers: join as a real Cookie header ("name=value; name2=value2")
    // so multi-cookie sessions (sso + cf_clearance + …) actually authenticate.
    const isCookieCreds = authType === "cookie" || provider?.authType === "cookie";
    let apiKey;
    if (isCookieCreds) {
      const pairs = requiredFields
        .map((f) => ({ id: f.id, v: String(data[f.id] || "").trim() }))
        .filter(({ v }) => v)
        .map(({ id, v }) => (v.includes("=") ? v : `${id}=${v}`));
      apiKey = pairs.join("; ");
    } else {
      apiKey = requiredFields.map((f) => data[f.id] || "").join(" ");
    }
    return { apiKey: apiKey.trim(), credentialData: Object.keys(data).length > 0 ? data : undefined };
  };

  const handleValidate = async () => {
    const { apiKey } = buildCredentialPayload();
    setValidating(true);
    setTestPassed(false);
    setValidateError("");
    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, providerSpecificData: buildProviderSpecificData() }),
      });
      const data = await res.json();
      const valid = !!data.valid;
      setValidationResult(valid ? "success" : "failed");
      setTestPassed(valid);
      if (!valid) setValidateError(data.error || "Validation failed — check the key and your server's connectivity to this provider");
    } catch (err) {
      setValidationResult("failed");
      setValidateError(err.message || "Validation request failed");
      setTestPassed(false);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!provider) return;
    const { apiKey, credentialData } = buildCredentialPayload();
    if (!isOllamaLocal && !apiKey) return;
    if (!isOllamaLocal) {
      if (!formData.name) return;
    }
    if (isCompatible && !formData.defaultModel.trim()) return;

    setSaving(true);
    try {
      let isValid = testPassed;
      if (!isValid) {
        try {
          setValidating(true);
          setValidationResult(null);
          setValidateError("");
          const res = await fetch("/api/providers/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider, apiKey: formData.apiKey, authType: isCookie ? "cookie" : undefined, providerSpecificData: buildProviderSpecificData() }),
          });
          const data = await res.json();
          isValid = !!data.valid;
          setValidationResult(isValid ? "success" : "failed");
          setTestPassed(isValid);
          if (!isValid) setValidateError(data.error || "Validation failed — the connection will be saved as untested");
        } catch (err) {
          setValidationResult("failed");
          setValidateError(err.message || "Validation request failed");
        } finally {
          setValidating(false);
        }
      }

      await onSave({
        name: formData.name || (isOllamaLocal ? "Ollama Local" : ""),
        apiKey,
        defaultModel: isCompatible ? formData.defaultModel.trim() : undefined,
        priority: formData.priority,
        proxyPoolId: formData.proxyPoolId === NONE_PROXY_POOL_VALUE ? null : formData.proxyPoolId,
        // "untested" is the spelling the status mappers and the test
        // route use for "we have no verdict".
        testStatus: isValid ? "active" : "untested",
        authType: isCookie ? "cookie" : undefined,
        providerSpecificData: credentialData || buildProviderSpecificData()
      });

      // Persist extracted models as custom models in the shared store so they
      // survive page refresh and appear on the provider detail page.
      if (models.length > 0 && !isCompatible) {
        const providerAlias = getProviderAlias(provider);
        // One batch request. This was a sequential await per model, so saving
        // a 76-model provider meant 76 round-trips one after another, and
        // every failure went to the console where nobody sees it.
        try {
          const res = await fetch("/api/models/custom", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerAlias,
              models: models.map((m) => ({ id: m.id, name: m.name || m.id, type: "llm" })),
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data.error || `Saved the connection, but could not save its models (HTTP ${res.status})`);
          }
        } catch (saveErr) {
          setError(`Saved the connection, but could not save its models: ${saveErr.message}`);
        }
        if (onBulkDone) onBulkDone();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSubmit = async () => {
    const lines = bulkText.split("\n");
    if (!lines.length) return;
    // Plan collision-free names against existing connections so a generated
    // "Key N" never matches a saved name (which the backend would upsert /
    // overwrite instead of inserting). See bulkAdd.js for the full rationale.
    const plan = planBulkAdd(lines, existingNames, { isCloudflareAi });
    if (!plan.length) return;
    setSaving(true);
    setBulkResult(null);
    let success = 0;
    let failed = 0;
    for (const entry of plan) {
      try {
        // Validate each key before saving so bulk-added connections get a
        // real status (active/unknown) like single adds, instead of a
        // hardcoded "unknown" that never flips until a manual test.
        let isValid = false;
        try {
          const vres = await fetch("/api/providers/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider, apiKey: entry.apiKey }),
          });
          const vdata = await vres.json().catch(() => ({}));
          isValid = !!vdata.valid;
        } catch {
          isValid = false;
        }
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            apiKey: entry.apiKey,
            name: entry.name,
            priority: 1,
            testStatus: isValid ? "active" : "unknown",
            ...(entry.providerSpecificData ? { providerSpecificData: entry.providerSpecificData } : {}),
          }),
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setSaving(false);
    setBulkResult({ success, failed });
    if (success > 0 && onBulkDone) onBulkDone();
  };

  if (!provider) return null;

  const handleExtractModels = async () => {
    setExtracting(true);
    setExtractError("");
    setExtractNote("");
    setModelStatus({});
    try {
      const res = await fetch("/api/providers/extract-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: formData.apiKey || undefined, providerSpecificData: buildProviderSpecificData() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExtractError(data.error || "Failed to extract models");
        setModels([]);
        return;
      }
      const list = data.models || [];
      setModels(list);
      if (data.static) {
        setExtractNote("Live models endpoint unavailable — showing the built-in catalog. You can still test each model.");
      } else if (!list.length) {
        setExtractNote("No models found for this provider.");
      } else {
        setExtractNote(`Extracted ${list.length} models. Test each one or run Test All to remove broken ones.`);
      }
    } catch (err) {
      setExtractError(err.message || "Failed to extract models");
    } finally {
      setExtracting(false);
    }
  };

  const handleTestModel = async (m) => {
    setTestingModelId(m.id);
    try {
      const res = await fetch("/api/providers/test-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: formData.apiKey, providerSpecificData: buildProviderSpecificData(), models: [m] }),
      });
      const data = await res.json().catch(() => ({}));
      const r = data.results?.[0];
      setModelStatus((prev) => ({
        ...prev,
        [m.id]: { ok: !!r?.ok, error: r?.error || null, latencyMs: r?.latencyMs },
      }));
    } catch (err) {
      setModelStatus((prev) => ({ ...prev, [m.id]: { ok: false, error: err.message } }));
    } finally {
      setTestingModelId(null);
    }
  };

  const handleTestAll = async () => {
    if (!models.length) return;
    setTestingAll(true);
    setExtractError("");
    setModelStatus({});
    try {
      const res = await fetch("/api/providers/test-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: formData.apiKey, providerSpecificData: buildProviderSpecificData(), models }),
      });
      const data = await res.json().catch(() => ({}));
      const results = data.results || [];
      const statusMap = {};
      results.forEach((r) => {
        statusMap[r.modelId] = { ok: !!r.ok, error: r.error, latencyMs: r.latencyMs };
      });
      setModelStatus(statusMap);
      const failedIds = new Set(results.filter((r) => !r.ok).map((r) => r.modelId));
      const okCount = results.filter((r) => r.ok).length;
      if (failedIds.size) {
        setModels((prev) => prev.filter((m) => !failedIds.has(m.id)));
        setExtractNote(`Tested ${results.length} models — ${okCount} OK, ${results.length - okCount} failed and removed from the list.`);
      } else {
        setExtractNote(`All ${results.length} models tested and OK.`);
      }
    } catch (err) {
      setExtractError(err.message || "Failed to test models");
    } finally {
      setTestingAll(false);
    }
  };

  const handleRemoveModel = (id) => {
    setModels((prev) => prev.filter((m) => m.id !== id));
    setModelStatus((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <Modal isOpen={isOpen} title={`Add ${providerName || provider} ${credentialLabel}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Mode switcher */}
        <div className="flex gap-2">
          <Button size="sm" variant={mode === "single" ? "primary" : "ghost"} onClick={() => { setMode("single"); setBulkResult(null); }}>Single</Button>
          <Button size="sm" variant={mode === "bulk" ? "primary" : "ghost"} onClick={() => { setMode("bulk"); setBulkResult(null); }}>Bulk Add</Button>
        </div>

        {mode === "bulk" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-muted">
              {isCloudflareAi
                ? <>One key per line. Format: <code>name|apiKey|accountId</code> or just <code>apiKey</code> (auto-named by index).</>
                : provider === "qoder"
                  ? <>One PAT per line. Format: <code>name|pt-...</code> or just <code>pt-...</code> (auto-named by index).</>
                  : <>One key per line. Format: <code>name|apiKey</code> or just <code>apiKey</code> (auto-named by index).</>
              }
            </p>
            <textarea
              className="w-full rounded border border-accent/30 bg-sidebar p-2 text-sm font-mono resize-y min-h-[140px] focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={bulkPlaceholder}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            {bulkResult && (
              <div className={`text-sm font-medium ${bulkResult.failed > 0 ? "text-yellow-400" : "text-green-400"}`}>
                ✓ {bulkResult.success} added{bulkResult.failed > 0 ? `, ✗ ${bulkResult.failed} failed` : ""}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleBulkSubmit} fullWidth disabled={saving || !bulkText.trim()}>
                {saving ? "Adding..." : "Add All Keys"}
              </Button>
              <Button onClick={onClose} variant="ghost" fullWidth>Cancel</Button>
            </div>
          </div>
        )}

        {mode === "single" && (<>
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={isOllamaLocal ? "Ollama Local" : "Production Key"}
        />
        {isOllamaLocal && (
          <div className="flex gap-2">
            <Input
              label="Ollama Host URL"
              value={formData.ollamaHostUrl}
              onChange={(e) => setFormData({ ...formData, ollamaHostUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="flex-1"
            />
            <div className="pt-6">
              <Button onClick={handleValidate} disabled={validating || saving} variant="secondary">
                {validating ? "Checking..." : "Check"}
              </Button>
            </div>
          </div>
        )}
        {!isOllamaLocal && (
          <div className="flex flex-col gap-2">
            {credentialFields ? (
              <div className="flex flex-col gap-3">
                {credentialFields.map((field) => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-text-muted">
                      {field.label}
                      {field.required && <span className="text-red-500 ms-1">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        className="w-full rounded-lg border border-accent/30 bg-sidebar px-3 py-2 text-sm font-mono resize-y min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
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
                      <div className="flex gap-2">
                        <Input
                          type={isCookie ? "text" : "password"}
                          value={formData.credentialData[field.id] || ""}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              credentialData: { ...formData.credentialData, [field.id]: e.target.value },
                            });
                            setTestPassed(false);
                            setValidationResult(null);
                          }}
                          placeholder={field.placeholder || ""}
                          className="flex-1"
                        />
                        {field === credentialFields[0] && (
                          <div className="pt-6 flex flex-col gap-1.5">
                            <Button onClick={handleValidate} disabled={credentialFields.filter(f=>f.required).some(f => !formData.credentialData[f.id]) || validating || saving} variant="secondary">
                              {validating ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                  {translate("Testing...")}
                                </span>
                              ) : testPassed ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                                  {translate("Test Connection")}
                                </span>
                              ) : (
                                translate("Test Connection")
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {field.hint && (
                      <p className="text-[11px] text-teal-600 dark:text-teal-400">{field.hint}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  label={credentialLabel}
                  type={isCookie ? "text" : "password"}
                  value={formData.apiKey}
                  onChange={(e) => { setFormData({ ...formData, apiKey: e.target.value }); setTestPassed(false); setValidationResult(null); }}
                  placeholder={credentialPlaceholder}
                  className="flex-1"
                />
                <div className="pt-6 flex flex-col gap-1.5">
                  <Button onClick={handleValidate} disabled={!formData.apiKey || validating || saving} variant="secondary">
                    {validating ? (
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                        {translate("Testing...")}
                      </span>
                    ) : testPassed ? (
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                        {translate("Test Connection")}
                      </span>
                    ) : (
                      translate("Test Connection")
                    )}
                  </Button>
                  {!isCookie && !isCompatible && (
                    <Button onClick={handleExtractModels} disabled={extracting || saving} variant="secondary">
                      {extracting ? "Extracting..." : "Extract Models"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {isXaiApiKey && (
          <p className="text-xs text-text-muted">
            Use a direct xAI API key from console.x.ai. This is separate from Grok Build OAuth.
          </p>
        )}
        {isCookie && (
          <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-300">
              <span className="material-symbols-outlined text-[14px]">cookie</span>
              Cookie Connection
            </div>
            <p className="text-xs text-text-muted">
              {cookieHint || authHint || "Paste the required browser cookie value below."}
            </p>
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary underline"
              >
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                Open {website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        )}
        {providerRegions && (
          <Select
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            options={providerRegions.map((r) => ({ value: r.id, label: r.label }))}
          />
        )}
        {isCompatible && (
          <Input
            label="Default Model"
            value={formData.defaultModel}
            onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
            placeholder={isAnthropic ? "claude-3-5-sonnet-latest" : "gpt-4o-mini"}
          />
        )}
        {isOllamaLocal && (
          <p className="text-xs text-text-muted">
            Leave blank to use <code>http://localhost:11434</code>. For remote Ollama, enter the full host URL (e.g. <code>http://192.168.1.10:11434</code>).
          </p>
        )}
        {validationResult && (
          <Badge variant={validationResult === "success" ? "success" : "error"}>
            {validationResult === "success" ? translate("Connection verified") : translate("Connection failed")}
          </Badge>
        )}
        {validateError && (
          <p className="text-xs text-red-500 break-words">{validateError}</p>
        )}
        {!testPassed && formData.apiKey && formData.name && !validating && (
          <p className="text-xs text-amber-500">{translate("Test connection before saving")}</p>
        )}
        {error && (
          <p className="text-xs text-red-500 break-words">{error}</p>
        )}
        {extractError && (
          <p className="text-xs text-red-500 break-words">{extractError}</p>
        )}

        {models.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-accent/20 bg-sidebar/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Models ({models.length})</h3>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" onClick={handleTestAll} disabled={testingAll || !models.length}>
                  <span className={cn("material-symbols-outlined text-[14px]", testingAll && "animate-spin")}>
                    {testingAll ? "progress_activity" : "fact_check"}
                  </span>
                  {testingAll ? "Testing..." : "Test All"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setModels([]); setModelStatus({}); setExtractNote(""); }}>
                  Clear
                </Button>
              </div>
            </div>
            {extractNote && (
              <p className="text-xs text-text-muted">{extractNote}</p>
            )}
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {models.map((m) => {
                const st = modelStatus[m.id];
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-sidebar px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{m.name || m.id}</p>
                      <p className="truncate font-mono text-[11px] text-text-muted">{m.id}</p>
                      {st && (
                        <p className={cn("text-[11px]", st.ok ? "text-emerald-500" : "text-red-500")}>
                          {st.ok ? `OK${st.latencyMs ? ` (${st.latencyMs}ms)` : ""}` : st.error || "Failed"}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleTestModel(m)} disabled={testingAll || testingModelId === m.id}>
                        <span className={cn("material-symbols-outlined text-[14px]", testingModelId === m.id && "animate-spin")}>
                          {testingModelId === m.id ? "progress_activity" : "play_arrow"}
                        </span>
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleRemoveModel(m.id)}>
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-text-muted">
              Failed models are removed when you run Test All. The remaining list is saved with this connection.
            </p>
          </div>
        )}
        {isCompatible && (
          <p className="text-xs text-text-muted">
            Enter the model ID exactly as your compatible endpoint expects it. This model will be saved as the connection default.
          </p>
        )}
        {isCloudflareAi && (
          <div className="bg-sidebar/50 p-4 rounded-lg border border-accent/20">
            <h3 className="font-semibold mb-3 text-sm">Cloudflare Workers AI</h3>
            <Input
              label="Account ID"
              value={cloudflareData.accountId}
              onChange={(e) => setCloudflareData({ ...cloudflareData, accountId: e.target.value })}
              placeholder="abc123def456..."
            />
            <p className="text-xs text-text-muted mt-2">
              Find your Account ID in the right sidebar of <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">dash.cloudflare.com</a>
            </p>
          </div>
        )}
        {isAzure && (
          <div className="bg-sidebar/50 p-4 rounded-lg border border-accent/20">
            <h3 className="font-semibold mb-3 text-sm">Azure OpenAI Configuration</h3>
            <div className="flex flex-col gap-3">
              <Input
                label="Azure Endpoint"
                value={azureData.azureEndpoint}
                onChange={(e) => setAzureData({ ...azureData, azureEndpoint: e.target.value })}
                placeholder="https://your-resource.openai.azure.com"
              />
              <Input
                label="Deployment Name"
                value={azureData.deployment}
                onChange={(e) => setAzureData({ ...azureData, deployment: e.target.value })}
                placeholder="gpt-4"
              />
              <Input
                label="API Version"
                value={azureData.apiVersion}
                onChange={(e) => setAzureData({ ...azureData, apiVersion: e.target.value })}
                placeholder="2024-10-01-preview"
              />
              <Input
                label="Organization"
                value={azureData.organization}
                onChange={(e) => setAzureData({ ...azureData, organization: e.target.value })}
                placeholder="Organization ID"
              />
            </div>
          </div>
        )}

        <Input
          label="Priority"
          type="number"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: Number.parseInt(e.target.value) || 1 })}
        />

        <Select
          label="Proxy Pool"
          value={formData.proxyPoolId}
          onChange={(e) => setFormData({ ...formData, proxyPoolId: e.target.value })}
          options={[
            { value: NONE_PROXY_POOL_VALUE, label: "None" },
            ...(proxyPools || []).map((pool) => ({ value: pool.id, label: pool.name })),
          ]}
          placeholder="None"
        />

        {(proxyPools || []).length === 0 && (
          <p className="text-xs text-text-muted">
            No active proxy pools available. Create one in Proxy Pools page first.
          </p>
        )}

        <p className="text-xs text-text-muted">
          Legacy manual proxy fields are still accepted by API for backward compatibility.
        </p>

        <div className="flex gap-2">
          <Button onClick={handleSubmit} fullWidth disabled={saving || (!isOllamaLocal && (!formData.name || !formData.apiKey || !testPassed)) || (isCompatible && !formData.defaultModel.trim()) || (isAzure && (!azureData.azureEndpoint || !azureData.deployment || !azureData.organization)) || (isCloudflareAi && !cloudflareData.accountId)}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            Cancel
          </Button>
        </div>
        </>)}
      </div>
    </Modal>
  );
}

AddApiKeyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  provider: PropTypes.string,
  providerName: PropTypes.string,
  isCompatible: PropTypes.bool,
  isAnthropic: PropTypes.bool,
  baseUrl: PropTypes.string,
  authType: PropTypes.string,
  authHint: PropTypes.string,
  cookieHint: PropTypes.string,
  website: PropTypes.string,
  credentialFields: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    placeholder: PropTypes.string,
    type: PropTypes.oneOf(["text", "password", "textarea"]),
    required: PropTypes.bool,
    hint: PropTypes.string,
  })),
  proxyPools: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
  })),
  error: PropTypes.string,
  existingNames: PropTypes.arrayOf(PropTypes.string),
  onSave: PropTypes.func.isRequired,
  onBulkDone: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
