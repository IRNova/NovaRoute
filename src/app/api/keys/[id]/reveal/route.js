import { NextResponse } from "next/server";
import { getApiKeyById } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

// GET /api/keys/[id]/reveal - Reveal full key
export async function GET(request, { params }) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ key: key.key });
  } catch (error) {
    console.log("Error revealing key:", error);
    return NextResponse.json({ error: "Failed to reveal key" }, { status: 500 });
  }
}
