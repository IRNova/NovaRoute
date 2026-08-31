/**
 * Smart Router API
 * 
 * Provides endpoints for intelligent routing:
 * - GET /api/routing/smart - Get routing stats
 * - POST /api/routing/smart/route - Route a request
 * - PUT /api/routing/smart/strategy - Update routing strategy
 * - GET /api/routing/smart/health - Get provider health
 */

import { NextResponse } from "next/server";
import { getSmartRouter } from "@/lib/routing/smartRouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routing/smart
 * Get routing statistics
 */
export async function GET(request) {
  try {
    const router = getSmartRouter();
    const { searchParams } = new URL(request.url);
    
    const action = searchParams.get("action") || "stats";
    
    switch (action) {
      case "stats":
        const stats = router.getStats();
        return NextResponse.json(stats);
      
      case "history":
        const limit = parseInt(searchParams.get("limit") || "100");
        const history = router.getHistory(limit);
        return NextResponse.json({ history });
      
      case "health":
        const healthData = Array.from(router.healthTracker.healthData.entries()).map(([key, data]) => ({
          key,
          ...data,
          score: router.healthTracker.getHealthScore(...key.split(":")),
          available: router.healthTracker.isAvailable(...key.split(":")),
        }));
        return NextResponse.json({ health: healthData });
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Smart Router API] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/routing/smart/route
 * Route a request to the best provider
 */
export async function POST(request) {
  try {
    const router = getSmartRouter();
    const body = await request.json();
    
    const { request: routingRequest, availableProviders } = body;
    
    if (!routingRequest) {
      return NextResponse.json(
        { error: "request is required" },
        { status: 400 }
      );
    }
    
    if (!availableProviders || !Array.isArray(availableProviders)) {
      return NextResponse.json(
        { error: "availableProviders array is required" },
        { status: 400 }
      );
    }
    
    // Route request
    const selected = await router.route(routingRequest, availableProviders);
    
    return NextResponse.json({
      selected,
      strategy: router.routingStrategy,
    });
  } catch (error) {
    console.error("[Smart Router API] POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/routing/smart/strategy
 * Update routing strategy
 */
export async function PUT(request) {
  try {
    const router = getSmartRouter();
    const body = await request.json();
    
    const { strategy } = body;
    
    if (!strategy) {
      return NextResponse.json(
        { error: "strategy is required" },
        { status: 400 }
      );
    }
    
    // Update strategy
    router.setStrategy(strategy);
    
    return NextResponse.json({
      strategy: router.routingStrategy,
      message: `Strategy updated to: ${strategy}`,
    });
  } catch (error) {
    console.error("[Smart Router API] PUT error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
