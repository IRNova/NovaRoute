// Client error log sink — everything the browser trap catches lands here,
// which means it shows up in `journalctl -u novaroute` like any server log.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tag = "[client:" + (body?.kind || "?") + "]";
    console.error(tag, body?.message || "(no message)");
    if (body?.stack) console.error(tag + "-stack", String(body.stack).slice(0, 1200));
    if (body?.url) console.error(tag + "-url", body.url);
    if (body?.body) console.error(tag + "-body", String(body.body).slice(0, 500));
  } catch { /* logging must never fail */ }
  return NextResponse.json({ ok: true });
}
