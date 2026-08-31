import { NextResponse } from "next/server";
import { getStats, prune, clear, list, deleteEntry } from "open-sse/semanticCache/index.js";
import { listEmbeddingProviders } from "open-sse/embeddings/index.js";

/**
 * GET /api/semantic-cache
 * Cache stats + configured embedding providers.
 * ?action=list&limit=50 to list entries.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    
    if (action === "list") {
      const limit = parseInt(searchParams.get("limit") || "50", 10);
      const entries = (await list({ limit })).map((e) => ({ ...e, key: e.id }));
      return NextResponse.json({ entries });
    }

    if (action === "trends" || action === "trend") {
      const { makeKv } = await import("@/lib/db/helpers/kvStore.js");
      const kv = makeKv("semanticStats");
      const ratePerMTok = Number(process.env.CACHE_EST_PRICE_PER_MTOK) || 0.25;
      const trends = [];
      for (let i = 13; i >= 0; i--) {
        const time = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        const v = (await kv.get(time, { hits: 0, misses: 0, tokensSaved: 0 })) || { hits: 0, misses: 0, tokensSaved: 0 };
        trends.push({
          time,
          hits: v.hits || 0,
          misses: v.misses || 0,
          tokensSaved: v.tokensSaved || 0,
          costSaved: Math.round(((v.tokensSaved || 0) / 1_000_000) * ratePerMTok * 10000) / 10000,
        });
      }
      return NextResponse.json({ trends });
    }

    const stats = await getStats();
    return NextResponse.json({ ...stats, embeddingProviders: listEmbeddingProviders() });
  } catch (error) {
    console.error("Error fetching semantic cache stats:", error);
    return NextResponse.json({ error: "Failed to fetch semantic cache stats" }, { status: 500 });
  }
}

/**
 * POST /api/semantic-cache/prune  → prune expired + overflow entries
 * DELETE /api/semantic-cache      → clear everything or delete one
 */
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "prune";
    if (action === "delete") {
      // Page contract: POST ?action=delete { key } — key is the entry id.
      const body = await request.json().catch(() => ({}));
      const id = body?.key || body?.id;
      if (!id) return NextResponse.json({ error: "key required" }, { status: 400 });
      const deleted = await deleteEntry(id);
      return NextResponse.json({ deleted });
    }
    if (action === "clear") {
      const cleared = await clear();
      return NextResponse.json({ cleared });
    }
    const pruned = await prune();
    return NextResponse.json({ pruned });
  } catch (error) {
    console.error("Error pruning semantic cache:", error);
    return NextResponse.json({ error: "Failed to prune semantic cache" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (id) {
      const deleted = await deleteEntry(id);
      return NextResponse.json({ deleted });
    }
    const cleared = await clear();
    return NextResponse.json({ cleared });
  } catch (error) {
    console.error("Error clearing semantic cache:", error);
    return NextResponse.json({ error: "Failed to clear semantic cache" }, { status: 500 });
  }
}
