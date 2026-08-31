/**
 * Channels API
 * 
 * GET /api/channels — List all channels
 * POST /api/channels — Add a channel
 * DELETE /api/channels/:id — Remove a channel
 * POST /api/channels/:id/connect — Connect a channel
 * POST /api/channels/:id/disconnect — Disconnect a channel
 */

import { NextResponse } from "next/server";
import { getChannelManager } from "@/lib/channels/channelManager";
import {
  restoreChannels,
  saveChannelDefinition,
  removeChannelDefinition,
} from "@/lib/channels/channelStore.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/channels
 * List all channels
 */
export async function GET(request) {
  try {
    const manager = getChannelManager();
    // Channels configured before the last restart live in the database.
    await restoreChannels(manager);
    const status = manager.getStatus();
    
    return NextResponse.json({
      channels: status,
      connected: manager.getConnectedChannels(),
    });
  } catch (error) {
    console.error("[Channels API] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/channels
 * Add a channel
 */
export async function POST(request) {
  try {
    const manager = getChannelManager();
    const body = await request.json();
    
    // Accept both `type` (original) and `id` (frontend) as the channel type.
    const type = body.type || body.id;
    const config = body.config || body.fields || {};
    const credentials = body.credentials || {};
    
    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }
    
    const channel = manager.createChannel(type, { config, credentials, name: body.name });

    await saveChannelDefinition({
      id: channel.id,
      type,
      name: body.name || type,
      config,
      // The webhook adapter mints its own inbound secret when none is given;
      // persist the effective value so the URL keeps working after a restart.
      credentials: channel.secret ? { ...credentials, secret: channel.secret } : credentials,
    });

    return NextResponse.json({
      channel: {
        ...channel.getStatus(),
        ...(channel.secret ? { inboundPath: `/api/channels/webhook/${channel.id}`, secret: channel.secret } : {}),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("[Channels API] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
