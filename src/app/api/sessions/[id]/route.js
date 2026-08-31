/**
 * Session API
 * 
 * GET /api/sessions/:id - Get session details
 * DELETE /api/sessions/:id - Delete a session
 * PUT /api/sessions/:id - Update session
 */

import { NextResponse } from "next/server";
import { getSessionManager } from "@/lib/mcp/sessionManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/:id
 * Get session details
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
    const includeMessages = searchParams.get("includeMessages") !== "false";
    const messageLimit = parseInt(searchParams.get("messageLimit") || "100");
    
    const response = {
      id: session.id,
      agentId: session.agentId,
      provider: session.provider,
      model: session.model,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      metadata: session.metadata,
      messageCount: session.messages.length,
      estimatedTokens: session.getEstimatedTokens(),
    };
    
    if (includeMessages) {
      response.messages = session.getMessagesForLLM({ limit: messageLimit });
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Sessions API] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/:id
 * Delete a session
 */
export async function DELETE(request, { params }) {
  try {
    const manager = getSessionManager();
    const { id } = params;
    
    const deleted = manager.deleteSession(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: `Session not found: ${id}` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("[Sessions API] DELETE error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sessions/:id
 * Update session
 */
export async function PUT(request, { params }) {
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
    
    // Update metadata
    if (body.metadata) {
      session.metadata = { ...session.metadata, ...body.metadata };
      session.updatedAt = Date.now();
    }
    
    // Clear messages if requested
    if (body.clearMessages) {
      session.clear();
    }
    
    return NextResponse.json({
      id: session.id,
      agentId: session.agentId,
      metadata: session.metadata,
      messageCount: session.messages.length,
    });
  } catch (error) {
    console.error("[Sessions API] PUT error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
