/**
 * Sessions API
 * 
 * Provides endpoints for session management:
 * - GET /api/sessions - List all sessions
 * - POST /api/sessions - Create a new session
 * - GET /api/sessions/:id - Get session details
 * - DELETE /api/sessions/:id - Delete a session
 * - POST /api/sessions/:id/messages - Add a message to session
 * - GET /api/sessions/:id/messages - Get session messages
 */

import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/mcp/sessionManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sessions
 * List all sessions
 */
export async function GET(request) {
  try {
    const manager = getSessionManager();
    const { searchParams } = new URL(request.url);
    
    const agentId = searchParams.get("agentId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action") || "list";
    
    switch (action) {
      case "list":
        const sessions = manager.listSessions({ agentId, limit, offset });
        const stats = manager.getStats();
        
        return NextResponse.json({
          sessions: sessions.map(s => ({
            id: s.id,
            agentId: s.agentId,
            provider: s.provider,
            model: s.model,
            messageCount: s.messages.length,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          })),
          stats,
        });
      
      case "stats":
        const sessionStats = manager.getStats();
        return NextResponse.json(sessionStats);
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Sessions API] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions
 * Create a new session
 */
export async function POST(request) {
  try {
    const manager = getSessionManager();
    const body = await request.json();
    
    const { agentId, provider, model, metadata } = body;
    
    // Create session
    const session = manager.createSession({
      agentId,
      provider,
      model,
      metadata,
    });
    
    return NextResponse.json({
      session: {
        id: session.id,
        agentId: session.agentId,
        provider: session.provider,
        model: session.model,
        createdAt: session.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[Sessions API] POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
