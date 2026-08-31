import { NextResponse } from "next/server";
import { createProviderConnection } from "@/lib/db/repos/connectionsRepo.js";

// POST /api/providers/import — bulk-import provider connections from JSON.
// Accepts an array of connections or { providers: [...] } / { connections: [...] }.
export async function POST(request) {
  try {
    const body = await request.json();
    const raw = body?.data ?? body;
    let items = [];
    if (Array.isArray(raw)) items = raw;
    else if (Array.isArray(raw?.providers)) items = raw.providers;
    else if (Array.isArray(raw?.connections)) items = raw.connections;
    else if (raw && typeof raw === "object") items = [raw];

    if (!items.length) {
      return NextResponse.json({ success: false, error: "No providers found in the provided data" }, { status: 400 });
    }

    let imported = 0;
    const errors = [];
    for (const [index, item] of items.entries()) {
      try {
        if (!item || typeof item !== "object" || !item.provider) {
          throw new Error("missing 'provider' field");
        }
        await createProviderConnection({
          ...item,
          isActive: item.isActive !== false,
        });
        imported += 1;
      } catch (err) {
        errors.push(`#${index + 1}${item?.provider ? ` (${item.provider})` : ""}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: imported > 0,
      imported,
      failed: errors.length,
      error: imported === 0 ? `Import failed: ${errors.slice(0, 3).join("; ")}` : errors.length ? `${errors.length} item(s) skipped` : null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
