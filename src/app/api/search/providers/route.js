import { NextResponse } from "next/server";
import { getProvidersByKind, getProviderAlias } from "@/shared/constants/providers";

/**
 * GET /api/search/providers - List providers that support web search.
 */
export async function GET() {
  try {
    const providers = getProvidersByKind("webSearch").map((provider) => ({
      id: provider.id,
      alias: getProviderAlias(provider.id) || provider.id,
      name: provider.name || provider.alias || provider.id,
      icon: provider.icon || "travel_explore",
      color: provider.color || undefined,
    }));

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error listing search providers:", error);
    return NextResponse.json(
      { error: "Failed to list search providers" },
      { status: 500 }
    );
  }
}
