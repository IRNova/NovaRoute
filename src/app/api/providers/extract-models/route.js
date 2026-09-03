import { NextResponse } from "next/server";
import { fetchProviderModels } from "@/lib/providerModelTools";
import { requireManagementAuth } from "@/lib/requireManagementAuth.js";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";

export const dynamic = "force-dynamic";

/**
 * POST /api/providers/extract-models
 * Fetch a provider's live model list. If no API key is supplied in the body,
 * the server auto-discovers it from the active connection saved for this
 * provider so extraction works out-of-the-box.
 * Body: { provider, apiKey?, providerSpecificData? }
 */
export async function POST(request) {
  try {
    const authError = await requireManagementAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const { provider, apiKey, providerSpecificData } = body || {};

    if (!provider) {
      return NextResponse.json({ error: "Provider is required" }, { status: 400 });
    }

    // If no API key was sent, look up the active connection for this provider
    // so we can use its stored credentials automatically.
    let resolvedKey = apiKey || undefined;
    let resolvedPsd = providerSpecificData || undefined;
    if (!resolvedKey) {
      try {
        const conns = await getProviderConnections({ provider, isActive: true });
        const conn = conns[0];
        if (conn?.apiKey) {
          resolvedKey = conn.apiKey;
        }
        if (!resolvedPsd && conn?.providerSpecificData) {
          resolvedPsd = conn.providerSpecificData;
        }
      } catch (e) {
        // Swallow — we'll just try without auth
      }
    }

    const result = await fetchProviderModels({ provider, apiKey: resolvedKey, providerSpecificData: resolvedPsd });
    const models = result.models || [];
    const warning = result.static
      ? (result.warning || "Using built-in catalog — live endpoint unavailable")
      : result.warning;

    // `static` must survive to the client. Without it the dashboard marked
    // every model "live", so the built-in catalogue was presented as though it
    // had just been read from the provider: models that do not exist there,
    // under names the provider does not use, with nothing saying so.
    return NextResponse.json({
      provider,
      models,
      static: Boolean(result.static),
      warning: warning || null,
    });
  } catch (error) {
    console.log("Error extracting models:", error);
    return NextResponse.json({ error: "Failed to extract models" }, { status: 500 });
  }
}
