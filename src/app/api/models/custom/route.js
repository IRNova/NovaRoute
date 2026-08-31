import { NextResponse } from "next/server";
import { getCustomModels, addCustomModel, deleteCustomModel } from "@/models";

export const dynamic = "force-dynamic";

// GET /api/models/custom - List all custom models
export async function GET() {
  try {
    const models = await getCustomModels();
    return NextResponse.json({ models });
  } catch (error) {
    console.log("Error fetching custom models:", error);
    return NextResponse.json({ error: "Failed to fetch custom models" }, { status: 500 });
  }
}

// POST /api/models/custom - Add custom model(s)
// Single:  { providerAlias, id, type?, name? }
// Batch:   { providerAlias, models: [{ id, type?, name? }] }
export async function POST(request) {
  try {
    const body = await request.json();
    const { providerAlias, type: defaultType, name: defaultName } = body || {};
    if (!providerAlias) {
      return NextResponse.json({ error: "providerAlias required" }, { status: 400 });
    }
    // Batch mode
    if (Array.isArray(body.models)) {
      let added = 0;
      for (const m of body.models) {
        const result = await addCustomModel({ providerAlias, id: m.id, type: m.type || defaultType || "llm", name: m.name || defaultName });
        if (result) added += 1;
      }
      return NextResponse.json({ success: true, added });
    }
    // Single mode
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const result = await addCustomModel({ providerAlias, id, type: defaultType || "llm", name: defaultName });
    return NextResponse.json({ success: true, added: result ? 1 : 0 });
  } catch (error) {
    console.log("Error adding custom model:", error);
    return NextResponse.json({ error: "Failed to add custom model" }, { status: 500 });
  }
}

// DELETE /api/models/custom?providerAlias=xxx&id=yyy&type=zzz
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerAlias = searchParams.get("providerAlias");
    const id = searchParams.get("id");
    const type = searchParams.get("type") || "llm";
    if (!providerAlias || !id) {
      return NextResponse.json({ error: "providerAlias and id required" }, { status: 400 });
    }
    await deleteCustomModel({ providerAlias, id, type });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error deleting custom model:", error);
    return NextResponse.json({ error: "Failed to delete custom model" }, { status: 500 });
  }
}
