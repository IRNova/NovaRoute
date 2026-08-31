import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ active: false, error: "not available" });
}
