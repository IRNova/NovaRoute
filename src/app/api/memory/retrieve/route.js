import { NextResponse } from "next/server";

export async function POST(req) {
  const { query } = await req.json();
  const results = [
    { content: `Relevant memory for "${query}"`, score: 0.92 },
    { content: `Another related memory for "${query}"`, score: 0.78 },
  ];
  return NextResponse.json({ results });
}
