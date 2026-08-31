/**
 * Plugins API
 * 
 * GET /api/plugins — List all plugins
 * POST /api/plugins — Register a plugin
 * POST /api/plugins/:id/enable — Enable a plugin
 * POST /api/plugins/:id/disable — Disable a plugin
 */

import { NextResponse } from "next/server";
import { getPluginSDK } from "@/lib/plugin-sdk/pluginSDK";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/plugins
 * List all plugins
 */
export async function GET(request) {
  try {
    const sdk = getPluginSDK();
    const plugins = sdk.listPlugins();
    
    return NextResponse.json({
      plugins,
      enabled: sdk.listEnabledPlugins().length,
      total: plugins.length,
    });
  } catch (error) {
    console.error("[Plugins API] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/plugins
 * Register a plugin
 */
export async function POST(request) {
  try {
    const sdk = getPluginSDK();
    const body = await request.json();
    
    // Plugin registration would require the actual plugin class
    // For now, return info about the SDK
    
    return NextResponse.json({
      message: "Plugin registration requires plugin class",
      sdk: await sdk.healthCheck(),
    }, { status: 201 });
  } catch (error) {
    console.error("[Plugins API] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
