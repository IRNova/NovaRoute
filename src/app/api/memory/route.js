/**
 * Memory API
 * 
 * GET /api/memory — List memories
 * POST /api/memory — Add a memory
 * POST /api/memory/search — Search memories
 * DELETE /api/memory/:id — Delete a memory
 */

import { NextResponse } from "next/server";
import { getMemorySystem } from "@/lib/memory/memorySystem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/memory
 * List memories
 */
export async function GET(request) {
  try {
    const memory = getMemorySystem();
    const { searchParams } = new URL(request.url);
    
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    
    let entries = Array.from(memory.entries.values());
    
    if (type) {
      entries = entries.filter(e => e.type === type);
    }
    
    entries = entries.slice(0, limit);
    
    return NextResponse.json({
      entries: entries.map(e => e.toJSON()),
      stats: memory.getStats(),
    });
  } catch (error) {
    console.error("[Memory API] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/memory
 * Add a memory
 */
export async function POST(request) {
  try {
    const memory = getMemorySystem();
    const body = await request.json();
    
    const { type, content, metadata } = body;
    
    if (!type || !content) {
      return NextResponse.json({ error: "type and content are required" }, { status: 400 });
    }
    
    const entry = await memory.addEntry(type, content, metadata);
    
    return NextResponse.json({
      entry: entry.toJSON(),
    }, { status: 201 });
  } catch (error) {
    console.error("[Memory API] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
