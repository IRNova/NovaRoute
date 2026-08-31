/**
 * MCP Servers API
 * 
 * Provides endpoints for managing MCP servers:
 * - GET /api/mcp/servers - List all installed servers
 * - POST /api/mcp/servers - Install a new server
 * - DELETE /api/mcp/servers/:id - Uninstall a server
 * - GET /api/mcp/servers/:id - Get server details
 * - PUT /api/mcp/servers/:id - Update server configuration
 * - POST /api/mcp/servers/:id/restart - Restart a server
 */

import { NextResponse } from "next/server";
import { getMcpServerManager } from "@/lib/mcp/mcpServerManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mcp/servers
 * List all installed MCP servers
 */
export async function GET(request) {
  try {
    const manager = getMcpServerManager();
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const includeCatalog = searchParams.get("includeCatalog") === "true";
    const pluginId = searchParams.get("pluginId");
    
    let response;
    
    if (pluginId) {
      // Get specific server
      const server = manager.installedServers.get(pluginId);
      if (!server) {
        return NextResponse.json(
          { error: `Server not found: ${pluginId}` },
          { status: 404 }
        );
      }
      
      const status = manager.getServerStatus(pluginId);
      response = { server, status };
    } else {
      // List all servers
      const servers = manager.listInstalledServers();
      const serversWithStatus = servers.map(server => ({
        ...server,
        status: manager.getServerStatus(server.id),
      }));
      
      response = { servers: serversWithStatus };
      
      // Include catalog if requested
      if (includeCatalog) {
        response.catalog = manager.getCatalog();
      }
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("[MCP API] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/servers
 * Install a new MCP server
 */
export async function POST(request) {
  try {
    const manager = getMcpServerManager();
    const body = await request.json();
    
    const { pluginId, customInstructions, accountKey } = body;
    
    if (!pluginId) {
      return NextResponse.json(
        { error: "pluginId is required" },
        { status: 400 }
      );
    }
    
    // Check if already installed
    if (manager.installedServers.has(pluginId)) {
      return NextResponse.json(
        { error: `Server already installed: ${pluginId}` },
        { status: 409 }
      );
    }
    
    // Install server
    const server = await manager.installServer(pluginId, {
      customInstructions,
      accountKey,
    });
    
    // Discover tools
    try {
      await manager.discoverTools(pluginId);
    } catch (error) {
      console.warn(`[MCP API] Failed to discover tools for ${pluginId}:`, error.message);
    }
    
    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    console.error("[MCP API] POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mcp/servers/:id
 * Uninstall an MCP server
 */
export async function DELETE(request, { params }) {
  try {
    const manager = getMcpServerManager();
    const { id } = params;
    
    // Check if installed
    if (!manager.installedServers.has(id)) {
      return NextResponse.json(
        { error: `Server not installed: ${id}` },
        { status: 404 }
      );
    }
    
    // Uninstall server
    const result = await manager.uninstallServer(id);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[MCP API] DELETE error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mcp/servers/:id
 * Update server configuration
 */
export async function PUT(request, { params }) {
  try {
    const manager = getMcpServerManager();
    const { id } = params;
    const body = await request.json();
    
    // Check if installed
    if (!manager.installedServers.has(id)) {
      return NextResponse.json(
        { error: `Server not installed: ${id}` },
        { status: 404 }
      );
    }
    
    const server = manager.installedServers.get(id);
    
    // Update custom instructions
    if (body.customInstructions !== undefined) {
      await manager.setCustomInstructions(id, body.customInstructions);
    }
    
    // Update tool policy
    if (body.toolPolicy) {
      for (const [toolName, action] of Object.entries(body.toolPolicy)) {
        await manager.updateToolPolicy(id, toolName, action);
      }
    }
    
    // Get updated server
    const updatedServer = manager.installedServers.get(id);
    
    return NextResponse.json({ server: updatedServer });
  } catch (error) {
    console.error("[MCP API] PUT error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
