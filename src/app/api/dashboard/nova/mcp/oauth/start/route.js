// MCP OAuth2 flow — step 1: build the provider's authorize URL.
// Body: { server: "<server name>" }
// The MCP server config in kv novaMcp must carry:
//   oauth: { clientId, clientSecret, authUrl, tokenUrl, scopes? }
// Returns { authorizeUrl } — admin opens it, provider redirects back to
// /api/dashboard/nova/mcp/oauth/callback.
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("novaMcp");

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const servers = (await kv.get("servers", [])) || [];
    const server = servers.find((s) => s.name === body?.server);
    if (!server) return NextResponse.json({ error: "unknown server" }, { status: 404 });
    const oa = server?.oauth;
    if (!oa?.clientId || !oa?.authUrl || !oa?.tokenUrl) {
      return NextResponse.json({ error: "server has no oauth config" }, { status: 400 });
    }

    const state = randomBytes(16).toString("hex");
    await kv.set(`state:${state}`, { server: server.name, at: Date.now() });

    const url = new URL(oa.authUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", oa.clientId);
    url.searchParams.set("state", state);
    if (oa.scopes) url.searchParams.set("scope", oa.scopes);
    const origin = new URL(request.url).origin;
    url.searchParams.set("redirect_uri", `${origin}/api/dashboard/nova/mcp/oauth/callback`);
    // PKCE-less confidential-client flow; providers requiring S256 should be
    // added later — most hosted MCP providers accept plain confidential flow.

    return NextResponse.json({ ok: true, authorizeUrl: url.toString() });
  } catch (error) {
    console.error("[api-err]", error?.stack || error);
    return NextResponse.json({ error: error?.message || "failed" }, { status: 500 });
  }
}
