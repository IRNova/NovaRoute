/**
 * Analytics API
 * 
 * GET /api/analytics — Get analytics configuration
 * POST /api/analytics/event — Track custom event
 */

import { NextResponse } from "next/server";
import { 
  isAnalyticsEnabled, 
  getGtmId, 
  trackEvent,
  initAnalytics 
} from "@/lib/analytics/googleAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics
 * Get analytics configuration
 */
export async function GET(request) {
  try {
    const config = initAnalytics();
    
    return NextResponse.json({
      enabled: isAnalyticsEnabled(),
      gtmId: getGtmId(),
      config,
    });
  } catch (error) {
    console.error("[Analytics] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/event
 * Track custom event
 */
export async function POST(request) {
  try {
    if (!isAnalyticsEnabled()) {
      return NextResponse.json({
        success: true,
        message: "Analytics is disabled",
      });
    }

    const body = await request.json();
    const { eventName, parameters } = body;

    if (!eventName) {
      return NextResponse.json(
        { error: "eventName is required" },
        { status: 400 }
      );
    }

    // Track event server-side
    trackEvent(eventName, parameters);

    return NextResponse.json({
      success: true,
      eventName,
    });
  } catch (error) {
    console.error("[Analytics] POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
