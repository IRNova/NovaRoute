// Nova Bot insights snapshot API — reads the latest kv rollup written by the
// curator tick. Auth is enforced by the global /api middleware.
import { NextResponse } from "next/server";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("novaInsights");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const latest = (await kv.get("latest", null)) || null;
    const suggestions = (await kv.get("suggestions", [])) || [];
    return NextResponse.json({ ok: true, latest, suggestions });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}
