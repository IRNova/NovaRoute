import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  return NextResponse.json(
    { success: false, error: "Tunnel start is not available on this deployment", id: params.tunnelId },
    { status: 503 }
  );
}
