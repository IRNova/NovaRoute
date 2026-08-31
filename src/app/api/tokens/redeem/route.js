import { NextResponse } from "next/server";
import { redeemToken } from "@/lib/db/repos/tokensRepo";

export async function POST(request) {
  try {
    const { code, apiKeyId } = await request.json();
    if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });
    const token = await redeemToken(code, apiKeyId || 'current');
    return NextResponse.json({ success: true, token });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
