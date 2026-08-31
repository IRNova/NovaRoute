import { NextResponse } from "next/server";
import { getProviderConnectionById, setModelTestResult } from "@/lib/localDb";
import { disableModels, enableModels } from "@/lib/disabledModelsDb";
import { getProviderModels, PROVIDER_ID_TO_ALIAS } from "open-sse/config/providerModels.js";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { pingModelByKind } from "@/app/api/models/test/ping";

/**
 * POST /api/providers/[id]/test-models
 * id = connectionId — used only to resolve provider + model list.
 * Optional body: { models: [{ id, name }] } to test a subset (single model test).
 * Actual requests go through the internal endpoint that matches each model kind.
 */
const GATEWAY_ERROR_RE = /missing api key|invalid api key|api key is disabled|not allowed for this api key|api key policy unavailable|usage limit|econnrefused|fetch failed/i;

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const connection = await getProviderConnectionById(id);
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    let requestedIds = null;
    try {
      const body = await request.json().catch(() => null);
      const requested = body?.models;
      if (Array.isArray(requested) && requested.length > 0) {
        requestedIds = new Set(
          requested.map((m) => m?.id || m?.name).filter(Boolean)
        );
      }
    } catch { /* no body / not JSON — test everything */ }

    const providerId = connection.provider;
    const isCompatible = isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);
    const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;

    let models = getProviderModels(alias);

    const baseUrl = `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`;

    // Compatible providers: fetch live model list
    if (isCompatible && models.length === 0) {
      try {
        const modelsRes = await fetch(`${baseUrl}/api/providers/${id}/models`);
        if (modelsRes.ok) {
          const data = await modelsRes.json();
          models = (data.models || []).map((m) => ({ id: m.id || m.name, name: m.name || m.id }));
        }
      } catch { /* fallback to empty */ }
    }

    if (requestedIds) {
      models = models.filter((m) => requestedIds.has(m.id || m.name));
    }

    if (models.length === 0) {
      return NextResponse.json({ provider: providerId, connectionId: id, results: [] });
    }

    // Warm up with first model to trigger token refresh (if needed) before parallel calls.
    // This prevents race condition where multiple requests concurrently refresh the same token.
    // Each ping is individually guarded: a single model timeout/error must not 500 the batch.
    const safePing = async (modelId, kind, baseUrl) => {
      try {
        return await pingModelByKind(`${alias}/${modelId}`, kind, baseUrl);
      } catch (err) {
        console.log(`[test-models] ${alias}/${modelId} ping error:`, err?.message || err);
        return { ok: false, latencyMs: 0, error: String(err?.message || err).slice(0, 300) || "Model test failed" };
      }
    };

    const [first, ...rest] = models;
    const firstKind = first.kind || first.type || "llm";
    const firstResult = await safePing(first.id, firstKind, baseUrl);

    // Gateway-level failure (our own auth/policy, or loopback unreachable) fails every
    // model identically — that is not a per-model problem, so don't disable anything.
    if (!firstResult.ok && GATEWAY_ERROR_RE.test(String(firstResult.error || ""))) {
      return NextResponse.json({
        provider: providerId,
        connectionId: id,
        results: [firstResult],
        error: `Gateway-level failure — no models were disabled. ${String(firstResult.error).slice(0, 240)}`,
      });
    }

    const results = [{ modelId: first.id, name: first.name || first.id, ...firstResult }];

    if (rest.length > 0) {
      const restResults = await Promise.all(
        rest.map(async (model) => {
          const result = await safePing(model.id, model.kind || model.type || "llm", baseUrl);
          return { modelId: model.id, name: model.name || model.id, ...result };
        })
      );
      results.push(...restResults);
    }

    // Same guard for the batch: identical gateway error on every model means the
    // provider was never actually reached.
    const allFailed = results.every((r) => !r.ok);
    const distinctErrors = new Set(results.map((r) => String(r.error || "")));
    if (allFailed && distinctErrors.size === 1 && GATEWAY_ERROR_RE.test([...distinctErrors][0])) {
      return NextResponse.json({
        provider: providerId,
        connectionId: id,
        results,
        error: `Gateway-level failure — no models were disabled. ${[...distinctErrors][0].slice(0, 240)}`,
      });
    }

    const failedIds = [];
    const passedIds = [];
    await Promise.all(results.map(async (result) => {
      if (!result.modelId) return;
      await setModelTestResult(alias, result.modelId, result);
      if (result.ok) passedIds.push(result.modelId);
      else failedIds.push(result.modelId);
    }));
    if (failedIds.length > 0) await disableModels(alias, failedIds);
    if (passedIds.length > 0) await enableModels(alias, passedIds);

    return NextResponse.json({ provider: providerId, connectionId: id, results, disabled: failedIds });
  } catch (error) {
    console.log("Error testing models:", error);
    return NextResponse.json({ error: "Test failed" }, { status: 500 });
  }
}
