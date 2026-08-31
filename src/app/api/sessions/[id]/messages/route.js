/**
 * Session Messages API
 * 
 * GET /api/sessions/:id/messages - Get session messages
 * POST /api/sessions/:id/messages - Add a message to session
 */

import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/mcp/sessionManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/:id/messages
 * Get session messages
 */
export async function GET(request, { params }) {
  try {
    const manager = getSessionManager();
    const { id } = params;
    
    const session = manager.getSession(id);
    
    if (!session) {
      return NextResponse.json(
        { error: `Session not found: ${id}` },
        { status: 404 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const includeSystem = searchParams.get("includeSystem") !== "false";
    
    const messages = session.getMessagesForLLM({
      includeSystem,
      limit,
    });
    
    return NextResponse.json({
      sessionId: id,
      messages,
      totalMessages: session.messages.length,
    });
  } catch (error) {
    console.error("[Sessions API] GET messages error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/:id/messages
 * Add a message to session
 */
export async function POST(request, { params }) {
  try {
    const manager = getSessionManager();
    const { id } = params;
    const body = await request.json();
    
    const session = manager.getSession(id);
    
    if (!session) {
      return NextResponse.json(
        { error: `Session not found: ${id}` },
        { status: 404 }
      );
    }
    
    const { role, content, metadata } = body;
    
    if (!role || !content) {
      return NextResponse.json(
        { error: "role and content are required" },
        { status: 400 }
      );
    }
    
    let message;
    
    switch (role) {
      case "user":
        message = session.addUserMessage(content, metadata);
        break;
      case "assistant":
        message = session.addAssistantMessage(content, metadata);
        break;
      case "system":
        message = session.addSystemMessage(content, metadata);
        break;
      default:
        return NextResponse.json(
          { error: `Invalid role: ${role}` },
          { status: 400 }
        );
    }
    
    // Save sessions
    manager.saveSessions();
    
    return NextResponse.json({
      message,
      session: {
        id: session.id,
        messageCount: session.messages.length,
        estimatedTokens: session.getEstimatedTokens(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[Sessions API] POST messages error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
