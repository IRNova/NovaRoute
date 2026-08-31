import { NextResponse } from "next/server";
import { getProviderConnections } from "@/models";
import { getDisabledModels } from "@/lib/disabledModelsDb";
import { AI_MODELS } from "@/shared/constants/config";
import { getProviderAlias } from "@/shared/constants/providers";

// GET /api/playground — model options for the playground selector.
export async function GET() {
  try {
    const disabled = await getDisabledModels();
    const connections = await getProviderConnections();
    const healthyProviders = new Set(
      connections.filter((c) => c.isActive !== false && c.testStatus !== "error").map((c) => c.provider)
    );

    const models = AI_MODELS
      .filter((m) => healthyProviders.size === 0 || healthyProviders.has(m.provider))
      .filter((m) => {
        const alias = getProviderAlias(m.provider) || m.provider;
        const list = disabled[alias] || disabled[m.provider] || [];
        return !list.includes(m.model);
      })
      .map((m) => {
        const fullModel = `${m.provider}/${m.model}`;
        return { value: fullModel, label: fullModel };
      });

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
