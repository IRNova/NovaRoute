import { NextResponse } from "next/server";
import { getDistinctProviders } from "@/lib/requestDetailsDb";
import { getProviderNodes } from "@/lib/localDb";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo.js";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";

export const dynamic = "force-dynamic";

/**
 * GET /api/usage/providers
 *
 * The providers that appear in request history, tagged with whether they still
 * exist in this installation.
 *
 * This used to return the raw DISTINCT provider column and nothing else, so the
 * filter offered every provider that had ever served a request: connections
 * deleted months ago, and ids that are not in the catalogue at all. They could
 * never disappear, because history does not change.
 *
 * `?scope=all` keeps the historical entries, which is how you still reach the
 * usage of something you have since removed. The default is what the operator
 * expects: what is in the system now.
 */
export async function GET(request) {
  try {
    const scope = new URL(request.url).searchParams.get("scope") || "current";

    // DISTINCT on the provider column, rather than parsing every row's JSON
    // blob (which can be hundreds of MB and once caused an OOM).
    const providerIds = await getDistinctProviders();

    const [providerNodes, connections] = await Promise.all([
      getProviderNodes(),
      getProviderConnections().catch(() => []),
    ]);

    const nodeMap = new Map(providerNodes.map((n) => [n.id, n.name]));
    const connected = new Set(connections.map((c) => c.provider));

    const providers = [];
    let historical = 0;

    for (const providerId of providerIds) {
      const config = getProviderByAlias(providerId) || AI_PROVIDERS[providerId];
      const isNode = nodeMap.has(providerId);
      const inCatalog = Boolean(config) || isNode;
      const isConnected = connected.has(providerId) || isNode;

      if (!isConnected) historical += 1;
      if (scope !== "all" && !isConnected) continue;

      providers.push({
        id: providerId,
        name: nodeMap.get(providerId) || config?.name || providerId,
        connected: isConnected,
        // false means the id is not even in the catalogue any more: a renamed
        // or deleted provider, or a compatible node that was removed.
        inCatalog,
      });
    }

    return NextResponse.json({
      providers,
      scope,
      // Lets the UI offer "also show providers I no longer have" honestly,
      // instead of silently hiding usage that really happened.
      historicalCount: historical,
    });
  } catch (error) {
    console.error("[API] Failed to get providers:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}
