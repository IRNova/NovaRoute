import { NextResponse } from "next/server";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("costsPricing");

// GET /api/costs/pricing — user cost overrides as a flat { "provider/model": $/1M } map.
export async function GET() {
  try {
    const stored = await kv.get("custom", {});
    return NextResponse.json(stored && typeof stored === "object" ? stored : {});
  } catch {
    return NextResponse.json({});
  }
}

// PATCH /api/costs/pricing — replace the flat override map.
export async function PATCH(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Expected a flat pricing object" }, { status: 400 });
    }
    const clean = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && key.includes("/")) {
        clean[key] = value;
      }
    }
    await kv.set("custom", clean);
    return NextResponse.json(clean);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
