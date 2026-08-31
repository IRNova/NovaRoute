import { NextResponse } from "next/server";
import { getModelTestResultsByProvider } from "@/models";

export const dynamic = "force-dynamic";

// GET /api/models/test-results?providerAlias=...
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerAlias = searchParams.get("providerAlias");
    if (!providerAlias) {
      return NextResponse.json({ error: "providerAlias is required" }, { status: 400 });
    }
    const results = await getModelTestResultsByProvider(providerAlias);
    return NextResponse.json({ providerAlias, results });
  } catch (error) {
    console.log("Error fetching model test results:", error);
    return NextResponse.json({ error: "Failed to fetch model test results" }, { status: 500 });
  }
}
