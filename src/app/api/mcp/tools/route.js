/**
 * MCP Tools API
 * 
 * Provides endpoints for tool discovery and execution:
 * - GET /api/mcp/tools - List all available tools
 * - POST /api/mcp/tools/execute - Execute a tool
 * - GET /api/mcp/tools/search - Search tools
 * - GET /api/mcp/tools/stats - Get tool statistics
 */

import { NextResponse } from "next/server";
import { getToolDiscovery } from "@/lib/mcp/toolDiscovery";
import { getToolExecutor } from "@/lib/mcp/toolExecution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mcp/tools
 * List all available tools
 */
export async function GET(request) {
  try {
    const discovery = getToolDiscovery();
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const pluginId = searchParams.get("pluginId");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const format = searchParams.get("format") || "internal";
    
    let tools;
    
    if (search) {
      // Search tools
      tools = discovery.searchTools(search);
    } else if (pluginId) {
      // Get tools for specific plugin
      tools = discovery.getToolsForServer(pluginId);
    } else if (category) {
      // Get tools by category
      tools = discovery.filterByCategory(category);
    } else {
      // Get all tools
      tools = discovery.getAllTools();
    }
    
    // Convert format if needed
    if (format === "openai") {
      tools = discovery.getToolDefinitionsForLLM();
    } else if (format === "claude") {
      tools = discovery.getToolDefinitionsForClaude();
    }
    
    // Get stats
    const stats = discovery.getStats();
    
    return NextResponse.json({
      tools,
      stats,
    });
  } catch (error) {
    console.error("[MCP API] GET tools error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
