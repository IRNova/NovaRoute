import { NextResponse } from "next/server";
import { getChannelManager } from "@/lib/channels/channelManager";
import { restoreChannels, removeChannelDefinition } from "@/lib/channels/channelStore.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/channels/[id] — disconnect and forget a channel.
export async function DELETE(request, { params }) {
  const { id } = await params;
  const manager = getChannelManager();
  await restoreChannels(manager);

  const channel = manager.getChannel(id);
  if (channel) {
    try {
      await channel.disconnect();
    } catch { /* a channel that will not close still gets removed */ }
    manager.channels.delete(id);
  }
  await removeChannelDefinition(id);
  return NextResponse.json({ deleted: true });
}
