"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Button, Badge, Input, Modal, Select } from "@/shared/components";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { cn } from "@/shared/utils/cn";
import { translate } from "@/i18n/runtime";

const NONE_PROXY_POOL_VALUE = "__none__";

export default function AddApiKeyModal({ isOpen, provider, providerName, isCompatible, isAnthropic, authType, authHint, website, baseUrl, proxyPools, error, existingNames, onSave, onBulkDone, onClose }) {
  const isOllamaLocal = provider === "ollama-local";
  const isCookie = authType === "cookie";
  const isXaiApiKey = provider === "xai" && !isCookie;
  const credentialLabel = isCookie ? "Cookie Value" : provider === "qoder" ? "Personal Access Token (PAT)" : "API Key";
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
  const [testPassed, setTestPassed] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleValidate = async () => {
    setValidating(true);
    setTestPassed(false);
    try {
      const res = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: formData.apiKey, providerSpecificData: buildProviderSpecificData() }),
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

  const handleSubmit = async () => {
    if (!provider || !formData.apiKey || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: formData.name || providerName || provider,
        apiKey: formData.apiKey,
        defaultModel: formData.defaultModel || undefined,
        priority: formData.priority,
        proxyPoolId: formData.proxyPoolId === NONE_PROXY_POOL_VALUE ? null : formData.proxyPoolId,
        providerSpecificData: buildProviderSpecificData(),
        testStatus: testPassed ? "active" : "unknown",
      });
      onClose();
    } catch (err) {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} title={`${translate("Add")} ${providerName || provider}`} onClose={onClose} size="md">
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <Input
          label={translate("Name")}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={providerName || provider}
        />

        <div className="flex flex-col gap-2">
          <Input
            label={translate(credentialLabel)}
            value={formData.apiKey}
            onChange={(e) => {
              setFormData({ ...formData, apiKey: e.target.value });
              setTestPassed(false);
              setValidationResult(null);
            }}
            placeholder={credentialPlaceholder}
            type="password"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleValidate}
              disabled={!formData.apiKey || validating}
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

        {isAzure && (
          <>
            <Input
              label="Azure Endpoint"
              value={azureData.azureEndpoint}
              onChange={(e) => setAzureData({ ...azureData, azureEndpoint: e.target.value })}
              placeholder="https://your-resource.openai.azure.com"
            />
            <Input
              label="API Version"
              value={azureData.apiVersion}
              onChange={(e) => setAzureData({ ...azureData, apiVersion: e.target.value })}
            />
            <Input
              label="Deployment"
              value={azureData.deployment}
              onChange={(e) => setAzureData({ ...azureData, deployment: e.target.value })}
            />
          </>
        )}

        {isCloudflareAi && (
          <Input
            label="Account ID"
            value={cloudflareData.accountId}
            onChange={(e) => setCloudflareData({ ...cloudflareData, accountId: e.target.value })}
            placeholder="your-account-id"
          />
        )}

        {isOllamaLocal && (
          <Input
            label="Ollama Host URL"
            value={formData.ollamaHostUrl}
            onChange={(e) => setFormData({ ...formData, ollamaHostUrl: e.target.value })}
            placeholder="http://localhost:11434"
          />
        )}

        {providerRegions && providerRegions.length > 0 && (
          <Select
            label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            options={providerRegions.map((r) => ({ value: r.id, label: r.name || r.id }))}
          />
        )}

        {proxyPools && proxyPools.length > 0 && (
          <Select
            label="Proxy Pool"
            value={formData.proxyPoolId}
            onChange={(e) => setFormData({ ...formData, proxyPoolId: e.target.value })}
            options={[
              { value: NONE_PROXY_POOL_VALUE, label: "None" },
              ...proxyPools.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        )}

        <Input
          label={translate("Priority")}
          type="number"
          min="1"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
          placeholder="1"
        />

        {!testPassed && formData.apiKey && formData.name && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {translate("Test connection before saving")}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSubmit} fullWidth disabled={!testPassed || saving} loading={saving}>
            {translate("Save")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            {translate("Cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

AddApiKeyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  provider: PropTypes.string.isRequired,
  providerName: PropTypes.string,
  isCompatible: PropTypes.bool,
  isAnthropic: PropTypes.bool,
  authType: PropTypes.string,
  authHint: PropTypes.string,
  website: PropTypes.string,
  baseUrl: PropTypes.string,
  proxyPools: PropTypes.array,
  error: PropTypes.string,
  existingNames: PropTypes.array,
  onSave: PropTypes.func.isRequired,
  onBulkDone: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
