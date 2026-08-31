import { NextResponse } from "next/server";
import { getSetupStatus, runProviderSetup, isSetupSupported } from "@/lib/providerSetup";

/**
 * GET /api/providers/[id]/setup — non-mutating status snapshot.
 * POST /api/providers/[id]/setup — run the one-click install/configure playbook.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!isSetupSupported(id)) {
      return NextResponse.json({ supported: false });
    }
    const status = await getSetupStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    console.log("Error reading provider setup status:", error);
    return NextResponse.json({ error: "Failed to read setup status" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!isSetupSupported(id)) {
      return NextResponse.json({ ok: false, error: "Provider does not support one-click setup" }, { status: 400 });
    }
    const result = await runProviderSetup(id);
    return NextResponse.json(result);
  } catch (error) {
    console.log("Error running provider setup:", error);
    return NextResponse.json({ ok: false, steps: [], error: String(error?.message || error) }, { status: 500 });
  }
}
