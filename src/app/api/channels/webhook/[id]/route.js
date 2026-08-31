import { NextResponse } from "next/server";
import { getChannelManager } from "@/lib/channels/channelManager";
import { restoreChannels } from "@/lib/channels/channelStore.js";
import { timingSafeEqualStr } from "@/lib/auth/timingSafe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/channels/webhook/[id] — inbound messages for a generic webhook
// channel. Authenticated by the channel's own secret, the same way the Telegram
// webhook is: this endpoint is reachable without a dashboard session, so the
// secret is the only thing standing in front of it.
export async function POST(request, { params }) {
  const { id } = await params;
  const manager = getChannelManager();
  await restoreChannels(manager);

  const channel = manager.getChannel(id);
  if (!channel || channel.type !== "webhook") {
    // Same answer for "wrong id" and "wrong secret": no probing.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const provided = request.headers.get("x-channel-secret") || "";
  if (!channel.secret || !timingSafeEqualStr(provided, channel.secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });

  const message = channel.ingest(payload);
  if (!message) {
    return NextResponse.json(
      { ok: false, error: `no text found at "${channel.textPath}" in the payload` },
      { status: 422 }
    );
  }
  return NextResponse.json({ ok: true, messageId: message.id });
}
