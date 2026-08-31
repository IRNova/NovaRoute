// MCP OAuth2 flow — step 2: provider redirects here with ?code&state.
// Exchanges the code for tokens and stores them on the server config.
import { NextResponse } from "next/server";
import { makeKv } from "@/lib/db/helpers/kvStore.js";

const kv = makeKv("novaMcp");

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return new Response("missing code/state", { status: 400 });

    const st = await kv.get(`state:${state}`, null);
    if (!st || Date.now() - (st?.at || 0) > 10 * 60_000) {
      return new Response("invalid or expired state", { status: 400 });
    }
    await kv.delete?.(`state:${state}`).catch(() => {});

    const servers = (await kv.get("servers", [])) || [];
    const idx = servers.findIndex((s) => s.name === st.server);
    if (idx === -1) return new Response("unknown server", { status: 404 });
    const server = servers[idx];
    const oa = server.oauth || {};
    if (!oa.tokenUrl) return new Response("server lacks tokenUrl", { status: 400 });

    const origin = url.origin;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: oa.clientId,
      ...(oa.clientSecret ? { client_secret: oa.clientSecret } : {}),
      redirect_uri: `${origin}/api/dashboard/nova/mcp/oauth/callback`,
    });
    const res = await fetch(oa.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const tokens = await res.json().catch(() => null);
    if (!res.ok || !tokens?.access_token) {
      return new Response(`token exchange failed: ${res.status}`, { status: 502 });
    }

    servers[idx].oauth = {
      ...oa,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || oa.tokens?.refresh_token || null,
        expires_at: Date.now() + (Number(tokens.expires_in) || 3600) * 1000,
        token_type: tokens.token_type || "Bearer",
      },
    };
    await kv.set("servers", servers);

    return new Response(
      `<!doctype html><meta charset=utf-8><body style="font-family:sans-serif;text-align:center;padding-top:4rem"><h2>✅ OAuth متصل شد</h2><p>سرور «${st.server}» آماده استفاده است. این تب را ببندید.</p></body>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  } catch (error) {
    return new Response(error?.message || "failed", { status: 500 });
  }
}
