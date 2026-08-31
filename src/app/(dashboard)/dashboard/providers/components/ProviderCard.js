"use client";

import PropTypes from "prop-types";
import ProviderIcon from "@/shared/components/ProviderIcon";
import Toggle from "@/shared/components/Toggle";
import { cn } from "@/shared/utils/cn";
import {
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
  resolveDisplayAuthType,
  resolveAuthModes,
} from "@/shared/constants/providers";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";
import { STATUS_META } from "./providerStatus";
import { translate } from "@/i18n/runtime";

const AUTH_BADGES = {
  oauth: { label: "Account Login", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  apikey: { label: "API Key", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  cookie: { label: "Cookie", cls: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  cli: { label: "CLI", cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  local: { label: "Local", cls: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
  compatible: { label: "Compatible", cls: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
};

function StatusLight({ state }) {
  const meta = STATUS_META[state] || STATUS_META.notConnected;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", meta.text)}>
      <span
        className={cn("size-2.5 shrink-0 rounded-full", meta.dot, meta.glow)}
        aria-hidden="true"
      />
      <span className="truncate">{translate(meta.label)}</span>
    </span>
  );
}

StatusLight.propTypes = {
  state: PropTypes.string.isRequired,
};

export function statusLightFor(state) {
  return <StatusLight state={state} />;
}

function resolveIcon(providerId, provider) {
  if (isOpenAICompatibleProvider(providerId)) {
    return provider.apiType === "responses"
      ? "/providers/oai-r.png"
      : "/providers/oai-cc.png";
  }
  if (isAnthropicCompatibleProvider(providerId)) return "/providers/anthropic-m.png";
  return getProviderIconSrc(provider.id);
}

function AuthBadge({ authType, modes }) {
  // Show EVERY real auth mode; a provider supporting both OAuth and API keys
  // must not be labeled as login-only.
  const list = Array.isArray(modes) && modes.length > 0 ? modes : [authType || "apikey"];
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {list.map((m) => {
        const meta = AUTH_BADGES[m] || AUTH_BADGES.apikey;
        return (
          <span
            key={m}
            title={translate(meta.label)}
            className={cn(
              "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              meta.cls
            )}
          >
            {translate(meta.label)}
          </span>
        );
      })}
    </span>
  );
}

AuthBadge.propTypes = { authType: PropTypes.string, modes: PropTypes.array };

export default function ProviderCard({
  providerId,
  provider,
  state,
  modelCount,
  size = "lg",
  testing = false,
  hasConnections = false,
  onEdit,
  onToggle,
  onTest,
  localRuntime = null,
  onTestLocalModel,
}) {
  const meta = STATUS_META[state] || STATUS_META.notConnected;
  const iconSrc = resolveIcon(providerId, provider);
  const iconTile =
    provider.color?.length > 7 ? provider.color : `${provider.color || "#888"}15`;
  const authType = resolveDisplayAuthType(providerId, provider);
  const authModes = resolveAuthModes(providerId, provider);
  const isDisabled = state === "disabled";
  // Without a connection there is nothing to disable — the runtime only skips
  // providers via their connections' isActive. Keep the switch visibly off-limits.
  const toggleTitle = !hasConnections
    ? translate("Connect this provider first")
    : isDisabled
      ? translate("Enable provider")
      : translate("Disable provider");

  const modelBlock = isDisabled ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <span className="material-symbols-outlined text-[14px]">visibility_off</span>
      {translate("Models hidden")}
    </span>
  ) : modelCount === -1 ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <span className="material-symbols-outlined text-[14px]">smart_toy</span>
      {translate("Any model (passthrough)")}
    </span>
  ) : !hasConnections && localRuntime ? (
    // Local runtime detected on this machine but not connected yet — show it
    // as installed with its live model list instead of a bare "no models".
    <span
      className="inline-flex min-w-0 items-center gap-1.5 text-xs text-green-600 dark:text-green-400"
      title={localRuntime.models.map((m) => m.id).join(", ")}
    >
      <span className="material-symbols-outlined text-[14px]">radar</span>
      {translate("Detected")} · {localRuntime.modelCount} {translate("models")}
      {localRuntime.models.length > 0 && (
        <span className="truncate font-mono text-[10px] text-text-muted">
          ({localRuntime.models.slice(0, 2).map((m) => m.id).join(", ")}{localRuntime.models.length > 2 ? "…" : ""})
        </span>
      )}
    </span>
  ) : modelCount > 0 ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <span className="material-symbols-outlined text-[14px]">smart_toy</span>
      <span className="tabular-nums">{modelCount}</span> {translate("active models")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <span className="material-symbols-outlined text-[14px]">smart_toy</span>
      {translate("No models listed")}
    </span>
  );

  const iconButton = onTest ? (
    <button
      type="button"
      title={translate("Test connection")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onTest) onTest();
      }}
      disabled={testing}
      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className={cn("material-symbols-outlined text-[14px]", testing && "animate-spin")}>
        {testing ? "progress_activity" : "play_arrow"}
      </span>
      {testing ? translate("Testing") : translate("Test")}
    </button>
  ) : null;

  const editButton = (
    <button
      type="button"
      title={translate("Edit provider")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onEdit) onEdit();
      }}
      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-primary/40 hover:text-primary"
    >
      <span className="material-symbols-outlined text-[14px]">edit</span>
      {translate("Edit")}
    </button>
  );

  if (size === "sm") {
    return (
      <div
        className={cn(
          "group relative flex flex-col gap-3 rounded-xl border-s-4 border bg-surface p-4 shadow-sm transition-all hover:shadow-md",
          meta.accent
        )}
      >
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: iconTile }}
            >
              <ProviderIcon
                src={iconSrc}
                alt={provider.name}
                size={28}
                className="max-h-[28px] max-w-[28px] rounded object-contain"
                fallbackText={provider.textIcon || providerId.slice(0, 2).toUpperCase()}
                fallbackColor={provider.color}
              />
            </div>
            <div className="min-w-0">
              <span
                className="block truncate text-sm font-semibold text-text-main"
                title={provider.name}
              >
                {provider.name}
              </span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <AuthBadge authType={authType} modes={authModes} />
                <StatusLight state={state} />
              </div>
            </div>
          </div>
          <div
            className="shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Toggle
              size="sm"
              checked={!isDisabled}
              disabled={!hasConnections}
              onChange={(next) => onToggle && onToggle(next)}
              aria-label={toggleTitle}
            />
          </div>
        </div>
        {localRuntime && localRuntime.models.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {localRuntime.models.slice(0, 6).map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                {m.id}
                {onTestLocalModel && (
                  <button
                    type="button"
                    title={translate("Test this model")}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTestLocalModel(m.id); }}
                    className="text-primary hover:text-text-main"
                  >
                    <span className="material-symbols-outlined !text-[12px]">play_arrow</span>
                  </button>
                )}
              </span>
            ))}
            {localRuntime.models.length > 6 && (
              <span className="text-[10px] text-text-muted">+{localRuntime.models.length - 6}</span>
            )}
          </div>
        )}
        <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border/70 pt-2">
          {modelBlock}
          <div className="flex shrink-0 items-center gap-1.5">
            {iconButton}
            {editButton}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border-s-4 border bg-surface p-5 shadow-sm transition-all hover:shadow-md",
        meta.accent
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: iconTile }}
            title={provider.name}
          >
            <ProviderIcon
              src={iconSrc}
              alt={provider.name}
              size={34}
              className="max-h-[34px] max-w-[34px] rounded-lg object-contain"
              fallbackText={provider.textIcon || providerId.slice(0, 2).toUpperCase()}
              fallbackColor={provider.color}
            />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="truncate font-semibold text-text-main"
                title={provider.name}
              >
                {provider.name}
              </span>
              <AuthBadge authType={authType} modes={authModes} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusLight state={state} />
            </div>
          </div>
        </div>
        <div
          className="shrink-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Toggle
            size="sm"
            checked={!isDisabled}
            disabled={!hasConnections}
            onChange={(next) => onToggle && onToggle(next)}
            aria-label={toggleTitle}
          />
        </div>
      </div>

        {localRuntime && localRuntime.models.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {localRuntime.models.slice(0, 6).map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                {m.id}
                {onTestLocalModel && (
                  <button
                    type="button"
                    title={translate("Test this model")}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTestLocalModel(m.id); }}
                    className="text-primary hover:text-text-main"
                  >
                    <span className="material-symbols-outlined !text-[12px]">play_arrow</span>
                  </button>
                )}
              </span>
            ))}
            {localRuntime.models.length > 6 && (
              <span className="text-[10px] text-text-muted">+{localRuntime.models.length - 6}</span>
            )}
          </div>
        )}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        {modelBlock}
        <div className="flex shrink-0 items-center gap-1.5">
          {iconButton}
          {editButton}
        </div>
      </div>
    </div>
  );
}

ProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    textIcon: PropTypes.string,
    apiType: PropTypes.string,
    authType: PropTypes.string,
  }).isRequired,
  state: PropTypes.string.isRequired,
  modelCount: PropTypes.number,
  size: PropTypes.oneOf(["lg", "sm"]),
  testing: PropTypes.bool,
  hasConnections: PropTypes.bool,
  onEdit: PropTypes.func,
  onToggle: PropTypes.func,
  onTest: PropTypes.func,
};
