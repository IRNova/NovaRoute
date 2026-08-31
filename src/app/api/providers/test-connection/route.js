import { NextResponse } from "next/server";
import { POST as validateProvider } from "../validate/route.js";

// POST /api/providers/test-connection — thin alias over /api/providers/validate
// returning the { success, error } shape the onboarding wizard expects.
export async function POST(request) {
  const res = await validateProvider(request);
  let body = {};
  try {
    body = await res.json();
  } catch {}
  return NextResponse.json(
    { success: body?.valid === true, error: body?.error || null },
    { status: res.status }
  );
}
