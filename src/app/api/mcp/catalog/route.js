/**
 * MCP Catalog API
 * 
 * Provides endpoints for browsing the plugin catalog:
 * - GET /api/mcp/catalog - List all available plugins
 * - GET /api/mcp/catalog/:id - Get plugin details
 * - GET /api/mcp/catalog/categories - List all categories
 */

import { NextResponse } from "next/server";
import { getMcpServerManager } from "@/lib/mcp/mcpServerManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mcp/catalog
 * List all available plugins
 */
export async function GET(request) {
  try {
    const manager = getMcpServerManager();
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const installed = searchParams.get("installed");
    
    let catalog = manager.getCatalog();
    
    // Filter by category
    if (category) {
      catalog = catalog.filter(p => p.category === category);
    }
    
    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      catalog = catalog.filter(p => 
        p.name.toLowerCase().includes(lowerSearch) ||
        p.displayName.toLowerCase().includes(lowerSearch) ||
        p.description.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Filter by installed status
    if (installed === "true") {
      catalog = catalog.filter(p => p.isInstalled);
    } else if (installed === "false") {
      catalog = catalog.filter(p => !p.isInstalled);
    }
    
    // Get categories
    const categories = [...new Set(manager.catalog.map(p => p.category))];
    
    return NextResponse.json({
      catalog,
      categories,
      total: catalog.length,
    });
  } catch (error) {
    console.error("[MCP Catalog API] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
