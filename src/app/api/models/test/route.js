import { NextResponse } from "next/server";
import { setModelTestResult } from "@/models";
import { pingProviderModel } from "@/lib/providerModelTools";
import { requireManagementAuth } from "@/lib/requireManagementAuth.js";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";

export const dynamic = "force-dynamic";

// POST /api/models/test - Ping a single model directly via provider API
// This bypasses the full NovaRoute chat pipeline and calls the provider API
// directly with the stored credentials — faster and more reliable for testing.
export async function POST(request) {
  try {
    const authError = await requireManagementAuth(request);
    if (authError) return authError;

    const { model, kind } = await request.json();
    if (!model) return NextResponse.json({ error: "Model required" }, { status: 400 });

    // Parse "provider/modelId" format
    const slashIdx = model.indexOf("/");
    if (slashIdx <= 0) {
      return NextResponse.json({ ok: false, error: "Model must be in 'provider/modelId' format" }, { status: 400 });
    }
    const providerAlias = model.slice(0, slashIdx);
    const modelId = model.slice(slashIdx + 1);

    // Look up the active connection for this provider
    const conns = await getProviderConnections({ provider: providerAlias, isActive: true });
    if (!conns || conns.length === 0) {
      // Also try without filtering by provider (for compatible/custom providers)
      const allConns = await getProviderConnections({ isActive: true });
      // If no active connection at all, use pingProviderModel which will handle the error
      const result = await pingProviderModel({
        provider: providerAlias,
        apiKey: "",
        providerSpecificData: {},
        model: modelId,
      });
      try {
        await setModelTestResult(providerAlias, modelId, result);
      } catch {}
      return NextResponse.json(result);
    }

    const conn = conns[0];
    const result = await pingProviderModel({
      provider: providerAlias,
      apiKey: conn.apiKey || "",
      providerSpecificData: conn.providerSpecificData || {},
      model: modelId,
    });

    // Persist the test result
    try {
      await setModelTestResult(providerAlias, modelId, result);
    } catch (persistErr) {
      console.log("Failed to persist model test result:", persistErr.message);
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
