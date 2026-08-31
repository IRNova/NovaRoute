// Memory graph data — nodes (memories) + edges (relatedness links) for viz.
import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getAdapter();
    let nodes = [];
    let edges = [];
    try {
      nodes = db.all(`SELECT id, skill_name as name, usage_count as weight FROM nova_memory ORDER BY usage_count DESC LIMIT 50`) || [];
    } catch { /* table may be empty */ }
    try {
      edges = db.all(
        `SELECT l.a_id as source, l.b_id as target, l.score as weight
         FROM nova_memory_links l
         JOIN nova_memory a ON a.id = l.a_id
         JOIN nova_memory b ON b.id = l.b_id
         LIMIT 300`
      ) || [];
    } catch { /* links optional */ }
    return NextResponse.json({ ok: true, nodes, edges });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}
