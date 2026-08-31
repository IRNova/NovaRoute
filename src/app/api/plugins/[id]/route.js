import { NextResponse } from "next/server";

export async function PUT(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  return NextResponse.json({ id, ...body });
}
