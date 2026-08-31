import { NextResponse } from "next/server";
import { AI_PROVIDERS, resolveProviderId } from "@/shared/constants/providers";

/**
 * POST /api/search - Perform a web search (stub implementation for the studio).
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const providerInput = body.provider || body.model || "tavily";
    const providerId = resolveProviderId(providerInput);
    const provider = AI_PROVIDERS[providerId];
    const query = typeof body.query === "string" ? body.query : "";

    if (!query.trim()) {
      return NextResponse.json(
        { error: "Missing required field: query" },
        { status: 400 }
      );
    }

    const topN = Math.min(Math.max(Number(body.top_n) || 5, 1), 20);
    const latencyMs = Math.floor(Math.random() * 300) + 120;
    const costPerQuery = provider?.searchConfig?.costPerQuery || 0.005;
    const cost = costPerQuery * topN;

    const results = Array.from({ length: topN }, (_, index) => ({
      title: `${query} — result ${index + 1}`,
      url: `https://example.com/search?q=${encodeURIComponent(query)}&r=${index + 1}`,
      snippet: `This is a simulated search result snippet for "${query}" from ${provider?.name || providerId}. It includes relevant content, source attribution, and estimated metrics for studio testing.`,
      source: provider?.name || providerId,
    }));

    return NextResponse.json({
      success: true,
      query,
      provider: providerId,
      results,
      latencyMs,
      cost,
      totalResults: topN * 4,
    });
  } catch (error) {
    console.error("Search stub error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
