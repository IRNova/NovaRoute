/**
 * Tool Execution API
 * 
 * POST /api/mcp/tools/execute
 * Execute a tool call
 */

import { NextResponse } from "next/server";
import { getToolExecutor } from "@/lib/mcp/toolExecution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mcp/tools/execute
 * Execute a tool
 */
export async function POST(request) {
  try {
    const executor = getToolExecutor();
    const body = await request.json();
    
    const { toolName, args, options } = body;
    
    if (!toolName) {
      return NextResponse.json(
        { error: "toolName is required" },
        { status: 400 }
      );
    }
    
    // Execute tool
    const result = await executor.execute(toolName, args || {}, options || {});
    
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[MCP API] Execute tool error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
