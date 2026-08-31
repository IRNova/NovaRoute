import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/models";
import { fetchProviderModels, pingProviderModel } from "@/lib/providerModelTools";
import { getModelsByProviderId, getDefaultModel } from "open-sse/config/providerModels.js";
import { resolveAuthModes } from "@/shared/constants/providers";
import { testSingleConnection } from "../test/testUtils.js";

export const dynamic = "force-dynamic";

const isNetworkError = (err) =>
  /ENOTFOUND|ECONNREFUSED|EAI_AGAIN|getaddrinfo|Invalid URL|Failed to parse URL|fetch failed/i.test(String(err));

/**
 * POST /api/providers/[id]/deep-test
 * Real end-to-end verification for a connection:
 *   1) Live model extraction from the provider (static catalogs are NOT accepted)
 *   2) Credential proof — a REAL minimal chat completion for HTTP/API providers;
 *      for CLI/OAuth-only providers the dedicated connection test (with token
 *      refresh) proves the session instead of a meaningless HTTP ping.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const conn = await getProviderConnectionById(id);
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const provider = conn.provider;
    const apiKey = conn.accessToken || conn.apiKey || "";
    const providerSpecificData = conn.providerSpecificData || {};

    // ── 1) Live model extraction (static = failure)
    let models = { source: "none", count: 0, sample: [], error: null };
    let liveModelIds = null;
    try {
      const r = await fetchProviderModels({ provider, apiKey, providerSpecificData });
      liveModelIds = !r.static && Array.isArray(r.models) ? r.models.map((m) => m.id) : null;
      models = r.static
        ? { source: "none", count: 0, sample: [], error: "Live extraction failed — static catalogs are disabled" }
        : {
            source: "live",
            count: r.models?.length || 0,
            sample: (r.models || []).slice(0, 5).map((m) => m.id),
            error: !r.models?.length ? (r.warning || "No models returned") : null,
          };
    } catch (e) {
      models.error = e.message;
    }

    // ── 2) Credential proof
    const modes = resolveAuthModes(provider);
    const canRealPing =
      modes.includes("apikey") ||
      modes.includes("compatible") ||
      (!!conn.apiKey && !modes.includes("oauth"));

    let chat;
    if (canRealPing) {
      // Try up to 3 candidate models before declaring the message check failed.
      const seen = new Set();
      const candidates = [
        getDefaultModel(provider),
        ...(liveModelIds || []),
        ...getModelsByProviderId(provider).map((m) => m.id),
      ].filter((m) => m && !seen.has(m) && seen.add(m));

      chat = { ok: false, model: null, latencyMs: 0, preview: null, error: "No model available to test", applicable: true };
      for (const model of candidates.slice(0, 3)) {
        const r = await pingProviderModel({ provider, apiKey, providerSpecificData, model });
        chat = { ...r, model, applicable: true };
        if (r.ok) break;
      }
    } else {
      // CLI / OAuth-only sessions: the dedicated per-provider connection test
      // (which refreshes tokens and speaks each provider's dialect) is the real
      // credential proof — an HTTP ping here would be meaningless.
      const connTest = await testSingleConnection(id).catch((e) => ({
        valid: false,
        error: e?.message || "connection test failed",
      }));
      chat = {
        ok: !!connTest.valid,
        model: null,
        latencyMs: 0,
        preview: null,
        error: connTest.valid ? null : (connTest.error || "Connection test failed"),
        applicable: false,
        via: "connection-test",
      };
    }

    // ── 3) URL sanity — inferred from the failure class of the attempts above
    const urlErrorSources = [models.error, chat.error].filter(Boolean);
    const badUrl = urlErrorSources.some((e) => isNetworkError(e));
    const url = {
      endpoint: `provider baseUrl (${provider})`,
      ok: !badUrl && (chat.ok || models.source === "live"),
      hint: badUrl
        ? "Host unreachable or URL malformed"
        : chat.ok || models.source === "live"
          ? null
          : "Reachable but rejected the request",
    };

    const authOk = chat.ok || models.source === "live" || models.count > 0;
    const verdict =
      models.count > 0 && chat.ok ? "pass" : chat.ok || models.count > 0 ? "partial" : "fail";

    return NextResponse.json({
      provider,
      connectionName: conn.name || null,
      checkedAt: new Date().toISOString(),
      url,
      auth: { ok: authOk },
      models,
      chat,
      verdict,
    });
  } catch (error) {
    console.log("deep-test error:", error);
    return NextResponse.json({ error: "Deep test failed" }, { status: 500 });
  }
}
