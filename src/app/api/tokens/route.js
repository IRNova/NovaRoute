import { NextResponse } from "next/server";
import { listTokens, createToken, revokeToken, deleteToken } from "@/lib/db/repos/tokensRepo";

export async function GET() {
  try {
    const tokens = await listTokens();
    return NextResponse.json({ tokens });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const token = await createToken(body);
    return NextResponse.json(token);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");
    if (action === "revoke") {
      await revokeToken(id);
    } else {
      await deleteToken(id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
