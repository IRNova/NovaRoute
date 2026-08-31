import { NextResponse } from "next/server";
import { pingProviderModel } from "@/lib/providerModelTools";

export const dynamic = "force-dynamic";

/**
 * POST /api/providers/test-models
 * Test each model of a provider by sending a minimal chat message, using a raw
 * (possibly unsaved) API key. Unlike /api/providers/[id]/test-models this does
 * not require the connection to be saved yet.
 * Body: { provider, apiKey, providerSpecificData?, models: [{ id, name }] }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { provider, apiKey, providerSpecificData, models } = body || {};

    if (!provider) {
      return NextResponse.json({ error: "Provider is required" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }
    if (!Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ error: "models must be a non-empty array" }, { status: 400 });
    }

    const results = await Promise.all(
      models.map(async (m) => {
        const id = m?.id || m?.model || m?.name;
        if (!id) return { modelId: null, name: m?.name || "", ok: false, error: "Missing model id" };
        const result = await pingProviderModel({ provider, apiKey, providerSpecificData, model: id });
        return { modelId: id, name: m?.name || id, ...result };
      })
    );

    return NextResponse.json({ provider, results });
  } catch (error) {
    console.log("Error testing models:", error);
    return NextResponse.json({ error: "Failed to test models" }, { status: 500 });
  }
}
