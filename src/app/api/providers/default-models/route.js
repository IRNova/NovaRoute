import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/providers/default-models - Get default models for all providers
export async function GET(request) {
  try {
    // Import PROVIDER_MODELS from open-sse config
    const { PROVIDER_MODELS } = await import("open-sse/config/providerModels.js");

    // Build response with default models for each provider
    const result = {};
    for (const [providerId, models] of Object.entries(PROVIDER_MODELS)) {
      if (Array.isArray(models) && models.length > 0) {
        result[providerId] = models.map(m => ({
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.contextWindow || m.contextLength || m.context_length || 4096,
          maxOutput: m.maxOutput || m.max_output_tokens || null,
          kind: m.kind || m.type || "llm",
        }));
      }
    }

    return NextResponse.json({ providers: result });
  } catch (error) {
    console.log("Error fetching default models:", error);
    return NextResponse.json({ error: "Failed to fetch default models", providers: {} }, { status: 500 });
  }
}
