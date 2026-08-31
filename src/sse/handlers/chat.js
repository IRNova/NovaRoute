import "open-sse/index.js";

import { getProviderCredentials,
  markAccountUnavailable,
  clearAccountError,
  extractApiKey,
  isValidApiKey,
  isInternalCliRequest,
} from "../services/auth.js";
import { getSettings } from "@/lib/localDb";
import { getModelInfo, getComboModels } from "../services/model.js";
import { handleChatCore } from "open-sse/handlers/chatCore.js";
import { DEFAULT_HEADROOM_URL } from "@/lib/headroom/detect";
import { getTransform as getPxpipeTransform } from "@/lib/pxpipe/loader.js";
import { appendPxpipeEvent } from "@/lib/pxpipe/events.js";
import { appendRtkEvent } from "@/lib/rtk/events.js";
import { errorResponse, unavailableResponse } from "open-sse/utils/error.js";
import { enforceApiKeyPolicy } from "@/lib/apiKeyPolicy";
import { handleComboChat, handleFusionChat, detectRequiredCapabilities } from "open-sse/services/combo.js";
import { augmentModelsWithCapacityAdapter, withCapacityAdapterStripping, getActiveAdapterStrategy } from "open-sse/services/capacityAdapter.js";
import { handleBypassRequest } from "open-sse/utils/bypassHandler.js";
import { HTTP_STATUS } from "open-sse/config/runtimeConfig.js";
import { detectFormatByEndpoint } from "open-sse/translator/formats.js";
import * as log from "../utils/logger.js";
import { updateProviderCredentials, checkAndRefreshToken } from "../services/tokenRefresh.js";
import { getProjectIdForConnection } from "open-sse/services/projectId.js";
import { detectTaskType } from "open-sse/routing/taskDetector.js";
import { selectModels, handleAdaptiveFallback } from "open-sse/routing/index.js";
import { SMART_MODEL_NAMES, GENIUS_WEIGHTS, GENIUS_MAX_CANDIDATES } from "open-sse/config/routingConfig.js";
import { tracedHandler } from "@/lib/monitoring/otel.js";

/**
 * Handle chat completion request
 * Supports: OpenAI, Claude, Gemini, OpenAI Responses API formats
 * Format detection and translation handled by translator
 */
async function handleChatImpl(request, clientRawRequest = null) {
  let body;
  try {
    body = await request.json();
  } catch {
    log.warn("CHAT", "Invalid JSON body");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body");
  }

  // Build clientRawRequest for logging (if not provided)
  if (!clientRawRequest) {
    const url = new URL(request.url);
    clientRawRequest = {
      endpoint: url.pathname,
      body,
      headers: Object.fromEntries(request.headers.entries())
    };
  }
  const modelStr = body.model;

  // Request summary is emitted as the unified "▶" line in chatCore (has fmt/thinking/account)

  // Log API key (masked)
  const authHeader = request.headers.get("Authorization");
  const apiKey = extractApiKey(request);
  if (authHeader && apiKey) {
    const masked = log.maskKey(apiKey);
    log.debug("AUTH", `API Key: ${masked}`);
  } else {
    log.debug("AUTH", "No API key provided (local mode)");
  }

  // Enforce API key if enabled in settings — but never against internal
  // self-tests (model pings / dashboard playground carry the CLI token).
  const internalCli = await isInternalCliRequest(request);
  const settings = await getSettings();
  if (!internalCli && settings.requireApiKey) {
    if (!apiKey) {
      log.warn("AUTH", "Missing API key (requireApiKey=true)");
      return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Missing API key");
    }
    const valid = await isValidApiKey(apiKey);
    if (!valid) {
      log.warn("AUTH", "Invalid API key (requireApiKey=true)");
      return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key");
    }
  }

  if (!modelStr) {
    log.warn("CHAT", "Missing model");
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing model");
  }

  // Resolve combo names before the first API-key policy check. External clients
  // often use restricted keys that allow the concrete provider/model but not the
  // friendly combo name. The concrete model/group checks still run for every
  // selected combo member in handleSingleModelChat, so this only avoids blocking
  // the virtual combo alias itself.
  let comboModels = await getComboModels(modelStr);

  // Enforce per-key policy: active, model/group access, USD usage limits (daily/weekly).
  // Internal self-tests skip client-key policy — a restricted consumer key must not
  // make every provider/model look broken (and get mass-disabled) during testing.
  const policy = internalCli
    ? { apiKey, apiKeyInfo: null, rejection: null }
    : await enforceApiKeyPolicy(request, comboModels ? null : modelStr);
  if (policy.rejection) return policy.rejection;

  // Thread resolved key metadata through to single-model handling so model/group
  // checks run against the concrete provider/model (and noLog survives combos).
  const apiKeyInfo = policy.apiKeyInfo;

  // Bypass naming/warmup requests before combo rotation to avoid wasting rotation slots
  const userAgent = request?.headers?.get("user-agent") || "";
  const bypassResponse = handleBypassRequest(body, modelStr, userAgent, !!settings.ccFilterNaming);
  if (bypassResponse) return bypassResponse.response || bypassResponse;

  const requiredCapabilities = detectRequiredCapabilities(body);

  // Adaptive routing: classify the request once for predictive scoring + smart selection.
  const taskType = detectTaskType(body).type;

  // Smart virtual models ("smart"/"auto"/"best"/"adaptive"): full adaptive
  // selection over all active connections + dynamic failover (Phase 1).
  if (settings.smartRoutingEnabled && SMART_MODEL_NAMES.has(String(modelStr).toLowerCase().trim())) {
    const isGenius = String(modelStr).toLowerCase().trim() === "genius";
    const maxCandidates = isGenius ? GENIUS_MAX_CANDIDATES : (settings.smartRoutingMaxCandidates || 6);
    log.info("ROUTE", `Smart model "${modelStr}" → taskType=${taskType}${isGenius ? " · genius mode" : ""}`);
    const { candidates } = await selectModels({
      body,
      taskType,
      maxCandidates,
      weights: isGenius ? GENIUS_WEIGHTS : (settings.smartRoutingWeights || undefined),
      localFirst: settings.localFirst,
    }).catch((err) => {
      log.warn("ROUTE", `smart selection failed: ${err?.message || err}`);
      return { candidates: [] };
    });
    if (candidates.length === 0) {
      log.warn("ROUTE", `No routing candidates for "${modelStr}"`);
      return errorResponse(HTTP_STATUS.SERVICE_UNAVAILABLE, `No routing candidates available for "${modelStr}"`);
    }
    return handleAdaptiveFallback({
      candidates,
      body,
      taskType,
      handleSingleModel: (b, m) => handleSingleModelChat(b, m, clientRawRequest, request, apiKey, apiKeyInfo, { taskType }),
      log,
      maxCandidates,
    });
  }

  // Check if model is a combo (has multiple models with fallback)
  if (comboModels) {
    // Optional smart reordering of combo members by adaptive score (opt-in).
    if (settings.smartReorderCombo) {
      comboModels = await smartReorderCandidates(comboModels, body, taskType, settings);
    }
    // Check for combo-specific strategy first, fallback to global
    const comboStrategies = settings.comboStrategies || {};
    const comboSpecificStrategy = comboStrategies[modelStr]?.fallbackStrategy;
    const comboStrategy = comboSpecificStrategy || settings.comboStrategy || "fallback";
    const augmentedModels = augmentModelsWithCapacityAdapter(comboModels, requiredCapabilities, settings);
    const adapterAdded = augmentedModels.filter((m) => !comboModels.includes(m));

    if (comboStrategy === "fusion") {
      log.info("CHAT", `Combo "${modelStr}" with ${comboModels.length} models (strategy: fusion)`);
      return handleFusionChat({
        body,
        models: comboModels,
        handleSingleModel: (b, m, isPanel) => {
          let cleanRawReq = clientRawRequest;
          if (isPanel && clientRawRequest) {
            const { tools, tool_choice, ...cleanBody } = clientRawRequest.body || {};
            cleanRawReq = { ...clientRawRequest, body: cleanBody };
          }
          return handleSingleModelChat(b, m, cleanRawReq, request, apiKey, apiKeyInfo, { taskType });
        },
        log,
        comboName: modelStr,
        judgeModel: comboStrategies[modelStr]?.judgeModel,
        tuning: comboStrategies[modelStr]?.fusionTuning,
      });
    }

    const comboStickyLimit = settings.comboStickyRoundRobinLimit;
    log.info("CHAT", `Combo "${modelStr}" with ${augmentedModels.length} models (strategy: ${comboStrategy}, sticky: ${comboStickyLimit})`);
    return handleComboChat({
      body,
      models: augmentedModels,
      handleSingleModel: withCapacityAdapterStripping(
        (b, m) => handleSingleModelChat(b, m, clientRawRequest, request, apiKey, apiKeyInfo, { taskType }),
        adapterAdded
      ),
      log,
      comboName: modelStr,
      comboStrategy,
      comboStickyLimit,
      comboStrategyConfig: comboStrategies[modelStr] || {},
      taskType,
    });
  }

  // Single model request — may still switch to a capacity-adapter model if the
  // target lacks a capability the request needs (e.g. no vision, request has an image).
    const soloAugmented = augmentModelsWithCapacityAdapter([modelStr], requiredCapabilities, settings);
  if (soloAugmented.length > 1) {
    const adapterAdded = soloAugmented.filter((m) => m !== modelStr);
    log.info("CHAT", `Capacity adapter for [${[...requiredCapabilities].join(",")}] on "${modelStr}" → trying ${soloAugmented.join(", ")}`);
    return handleComboChat({
      body,
      models: soloAugmented,
      handleSingleModel: withCapacityAdapterStripping(
        (b, m) => handleSingleModelChat(b, m, clientRawRequest, request, apiKey, apiKeyInfo, { taskType }),
        adapterAdded
      ),
      log,
      comboName: modelStr,
      comboStrategy: getActiveAdapterStrategy(requiredCapabilities, settings),
      taskType,
    });
  }

  return handleSingleModelChat(body, modelStr, clientRawRequest, request, apiKey, apiKeyInfo, { taskType });
}

/**
 * Optional smart reordering of combo members by adaptive score.
 * Unknown/unroutable entries keep their position at the tail. Fail-open.
 */
async function smartReorderCandidates(models, body, taskType, settings) {
  if (!Array.isArray(models) || models.length < 2) return models;
  try {
    const { rankCandidates, getStatsMap, buildPriceMap } = await import("open-sse/routing/index.js");
    const pool = models
      .map((m) => {
        const slash = m.indexOf("/");
        if (slash <= 0) return null;
        return { provider: m.slice(0, slash), model: m.slice(slash + 1) };
      })
      .filter(Boolean);
    if (pool.length < 2) return models;
    const [statsMap, priceMap] = await Promise.all([
      getStatsMap(taskType),
      buildPriceMap(pool),
    ]);
    const ranked = rankCandidates(pool, {
      taskType,
      weights: settings.smartRoutingWeights || undefined,
      statsMap,
      priceMap,
    });
    const ordered = ranked.map((r) => `${r.provider}/${r.model}`);
    const leftovers = models.filter((m) => !ordered.includes(m));
    return [...ordered, ...leftovers];
  } catch {
    return models;
  }
}

/**
 * Handle single model chat request
 */
async function handleSingleModelChat(body, modelStr, clientRawRequest = null, request = null, apiKey = null, apiKeyInfo = null, routingCtx = {}) {
  const modelInfo = await getModelInfo(modelStr);

  // If provider is null, this might be a combo name - check and handle
  if (!modelInfo.provider) {
    let comboModels = await getComboModels(modelStr);
    if (comboModels) {
      const chatSettings = await getSettings();
      // Check for combo-specific strategy first, fallback to global
      const comboStrategies = chatSettings.comboStrategies || {};
      const comboSpecificStrategy = comboStrategies[modelStr]?.fallbackStrategy;
      const comboStrategy = comboSpecificStrategy || chatSettings.comboStrategy || "fallback";
      const requiredCapabilities = detectRequiredCapabilities(body);
      if (chatSettings.smartReorderCombo) {
        comboModels = await smartReorderCandidates(comboModels, body, routingCtx.taskType, chatSettings);
      }
      const augmentedModels = augmentModelsWithCapacityAdapter(comboModels, requiredCapabilities, chatSettings);
      const adapterAdded = augmentedModels.filter((m) => !comboModels.includes(m));

      if (comboStrategy === "fusion") {
        log.info("CHAT", `Combo "${modelStr}" with ${comboModels.length} models (strategy: fusion)`);
        return handleFusionChat({
          body,
          models: comboModels,
          handleSingleModel: (b, m, isPanel) => {
            let cleanRawReq = clientRawRequest;
            if (isPanel && clientRawRequest) {
              const { tools, tool_choice, ...cleanBody } = clientRawRequest.body || {};
              cleanRawReq = { ...clientRawRequest, body: cleanBody };
            }
            return handleSingleModelChat(b, m, cleanRawReq, request, apiKey, apiKeyInfo, routingCtx);
          },
          log,
          comboName: modelStr,
          judgeModel: comboStrategies[modelStr]?.judgeModel,
          tuning: comboStrategies[modelStr]?.fusionTuning,
        });
      }

      const comboStickyLimit = chatSettings.comboStickyRoundRobinLimit;
      log.info("CHAT", `Combo "${modelStr}" with ${augmentedModels.length} models (strategy: ${comboStrategy}, sticky: ${comboStickyLimit})`);
      return handleComboChat({
        body,
        models: augmentedModels,
        handleSingleModel: withCapacityAdapterStripping(
          (b, m) => handleSingleModelChat(b, m, clientRawRequest, request, apiKey, apiKeyInfo, routingCtx),
          adapterAdded
        ),
        log,
        comboName: modelStr,
        comboStrategy,
        comboStickyLimit
      });
    }
    log.warn("CHAT", "Invalid model format", { model: modelStr });
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid model format");
  }

  const { provider, model } = modelInfo;

  // Routing shown in the unified "▶" line (client model → provider/model)

  // Extract userAgent from request
  const userAgent = request?.headers?.get("user-agent") || "";

  // Per-model/group access check against the concrete resolved provider+model.
  // (Active + USD limits are enforced once in handleChat; this adds the model
  //  and group rules that can only be evaluated once the model is known.)
  if (apiKeyInfo) {
    const { isModelAllowedForKey } = await import("@/lib/apiKeyPolicy");
    const { checkKeyModelAccess } = await import("@/lib/localDb");
    const restricted =
      apiKeyInfo.modelAccessMode === "restricted" ||
      (Array.isArray(apiKeyInfo.allowedModels) && apiKeyInfo.allowedModels.length > 0);
    if (restricted && !(await isModelAllowedForKey(apiKeyInfo, model))) {
      log.warn("AUTH", `Key denied model ${model} (allowedModels restrict)`);
      return errorResponse(HTTP_STATUS.FORBIDDEN, `Model "${model}" is not allowed for this API key`);
    }
    const groupAccess = await checkKeyModelAccess(apiKeyInfo.id, model, provider);
    if (!groupAccess.allowed) {
      log.warn("AUTH", `Key denied model ${model} via group rules`);
      return errorResponse(
        HTTP_STATUS.FORBIDDEN,
        groupAccess.deniedBy
          ? `Model "${model}" is denied for this API key`
          : `Model "${model}" is not allowed for this API key's groups`
      );
    }
  }

  // Try with available accounts (fallback on errors)
  const excludeConnectionIds = new Set();
  let lastError = null;
  let lastStatus = null;

  // Semantic cache: try to serve the request without hitting any upstream.
  // Only active for non-streaming, tool-free requests (see isCacheableRequest).
  const scSettings = await getSettings();
  if (scSettings.semanticCache?.enabled) {
    try {
      const { tryServeFromCache } = await import("open-sse/semanticCache/index.js");
      const cached = await tryServeFromCache({ body, provider, model, settings: scSettings });
      if (cached) {
        log.info("CACHE", `semantic hit ${cached.headers.get("x-novaroute-cache")} · ${provider}/${model}`);
        return cached;
      }
    } catch { /* cache must never break requests */ }
  }

  while (true) {
    const credentials = await getProviderCredentials(provider, excludeConnectionIds, model);

    // All accounts unavailable
    if (!credentials || credentials.allRateLimited) {
      if (credentials?.allRateLimited) {
        const errorMsg = lastError || credentials.lastError || "Unavailable";
        const status = lastStatus || Number(credentials.lastErrorCode) || HTTP_STATUS.SERVICE_UNAVAILABLE;
        log.warn("CHAT", `[${provider}/${model}] ${errorMsg} (${credentials.retryAfterHuman})`);
        return unavailableResponse(status, `[${provider}/${model}] ${errorMsg}`, credentials.retryAfter, credentials.retryAfterHuman);
      }
      if (excludeConnectionIds.size === 0) {
        log.warn("AUTH", `No active credentials for provider: ${provider}`);
        return errorResponse(HTTP_STATUS.NOT_FOUND, `No active credentials for provider: ${provider}`);
      }
      log.warn("CHAT", "No more accounts available", { provider });
      return errorResponse(lastStatus || HTTP_STATUS.SERVICE_UNAVAILABLE, lastError || "All accounts unavailable");
    }

    // Account selection shown in the unified "▶" line (acc:...)
    const refreshedCredentials = await checkAndRefreshToken(provider, credentials);

    // Ensure real project ID is available for providers that need it (P0 fix: cold miss)
    if ((provider === "antigravity" || provider === "gemini-cli") && !refreshedCredentials.projectId) {
      const pid = await getProjectIdForConnection(credentials.connectionId, refreshedCredentials.accessToken, provider);
      if (pid) {
        refreshedCredentials.projectId = pid;
        // Persist to DB in background so subsequent requests have it immediately
        updateProviderCredentials(credentials.connectionId, { projectId: pid }).catch(() => { });
      }
    }

    // Use shared chatCore
    const chatSettings = await getSettings();
    const providerThinking = (chatSettings.providerThinking || {})[provider] || null;
    const result = await handleChatCore({
      body: { ...body, model: `${provider}/${model}` },
      modelInfo: { provider, model },
      credentials: refreshedCredentials,
      log,
      clientRawRequest,
      connectionId: credentials.connectionId,
      userAgent,
      apiKey,
      ccFilterNaming: !!chatSettings.ccFilterNaming,
      rtkEnabled: !!chatSettings.rtkEnabled,
      headroomEnabled: !!chatSettings.headroomEnabled,
      headroomUrl: chatSettings.headroomUrl || DEFAULT_HEADROOM_URL,
      headroomCompressUserMessages: !!chatSettings.headroomCompressUserMessages,
      cavemanEnabled: !!chatSettings.cavemanEnabled,
      cavemanLevel: chatSettings.cavemanLevel || "full",
      ponytailEnabled: !!chatSettings.ponytailEnabled,
      ponytailLevel: chatSettings.ponytailLevel || "full",
      pxpipeEnabled: !!chatSettings.pxpipeEnabled,
      pxpipeMinChars: chatSettings.pxpipeMinChars,
      pxpipeTimeoutMs: chatSettings.pxpipeTimeoutMs,
      // Lazily warms the in-process module on first use; null when not installed (fail-open)
      pxpipeTransform: chatSettings.pxpipeEnabled ? await getPxpipeTransform() : null,
      onPxpipeEvent: appendPxpipeEvent,
      onRtkEvent: appendRtkEvent,
      providerThinking,
      // Detect source format by endpoint + body
      sourceFormatOverride: request?.url ? detectFormatByEndpoint(new URL(request.url).pathname, body) : null,
      taskType: routingCtx.taskType,
      semanticCompressEnabled: !!chatSettings.semanticCompressEnabled,
      semanticCompressUrl: chatSettings.semanticCompressUrl || "http://localhost:20128/v1/chat/completions",
      semanticCompressApiKey: chatSettings.semanticCompressApiKey || "",
      semanticCompressModel: chatSettings.semanticCompressModel || "gpt-5-mini",
      semanticCompressTimeoutMs: chatSettings.semanticCompressTimeoutMs || 12000,
      semanticCompressMinChars: chatSettings.semanticCompressMinChars || 120000,
      optimizerEnabled: !!chatSettings.promptOptimizer?.enabled,
      optimizerMode: chatSettings.promptOptimizer?.mode || "auto",
      optimizerTimeoutMs: chatSettings.promptOptimizer?.timeoutMs || 8000,
      optimizerLlmEndpoint: chatSettings.promptOptimizer?.llmEndpoint || "http://localhost:20128/v1/chat/completions",
      optimizerLlmApiKey: chatSettings.promptOptimizer?.llmApiKey || "",
      optimizerLlmModel: chatSettings.promptOptimizer?.llmModel || "gpt-5-mini",
      onCredentialsRefreshed: async (newCreds) => {
        await updateProviderCredentials(credentials.connectionId, {
          ...newCreds,
          existingProviderSpecificData: credentials.providerSpecificData,
          testStatus: "active"
        });
      },
      onRequestSuccess: async () => {
        await clearAccountError(credentials.connectionId, credentials, model);
      }
    });

    if (result.success) {
      // Semantic cache: store successful non-streaming JSON responses (fire-and-forget).
      if (scSettings.semanticCache?.enabled) {
        try {
          const ct = result.response?.headers?.get?.("content-type") || "";
          if (ct.includes("application/json") && !ct.includes("text/event-stream")) {
            const { storeResponseInCache } = await import("open-sse/semanticCache/index.js");
            const bodyText = await result.response.clone().text().catch(() => "");
            if (bodyText) {
              storeResponseInCache({
                body,
                provider,
                model,
                responseBody: bodyText,
                endpoint: clientRawRequest?.endpoint,
                settings: scSettings,
              }).catch(() => {});
            }
          }
        } catch { /* cache store must never break requests */ }
      }
      return result.response;
    }

    // Mark account unavailable (auto-calculates cooldown with exponential backoff, or precise resetsAtMs)
    const { shouldFallback } = await markAccountUnavailable(credentials.connectionId, result.status, result.error, provider, model, result.resetsAtMs);

    if (shouldFallback) {
      log.warn("FALLBACK", `⇄ ACC:${credentials.connectionName} UNAVAILABLE (${result.status}) → NEXT ACCOUNT`);
      excludeConnectionIds.add(credentials.connectionId);
      lastError = result.error;
      lastStatus = result.status;
      continue;
    }

    return result.response;
  }
}

// Traced at the boundary: one span per gateway call, with the provider,
// model and token counts filled in by saveRequestUsage. No-op unless an
// OTLP endpoint is configured.
export const handleChat = tracedHandler("chat.completions", handleChatImpl);
