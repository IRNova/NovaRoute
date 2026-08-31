import { NextResponse } from "next/server";
import { getApiKeys } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { requireManagementAuth } from "@/lib/requireManagementAuth";

export const dynamic = "force-dynamic";

const CLI_TOKEN_SALT = "9r-cli-auth";

/**
 * POST /api/dashboard/chat/completions
 *
 * Dashboard chat gateway. Authenticates with the dashboard session (JWT cookie)
 * or CLI token, then proxies the streaming chat request to the internal
 * /api/v1/chat/completions using an active gateway API key — the browser never
 * needs to hold a raw key.
 */
export async function POST(request) {
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) return rejection;

    const keys = await getApiKeys();
    const apiKey = keys.find((k) => k.isActive !== false)?.key || null;
    if (!apiKey) {
      return NextResponse.json(
        { error: "No active API key configured. Create one in Settings → API Keys." },
        { status: 401 }
      );
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-9r-cli-token": await getConsistentMachineId(CLI_TOKEN_SALT),
    };

    const body = await request.text();
    const target = new URL(request.url);
    target.pathname = "/api/v1/chat/completions";
    target.search = "";

    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body,
      signal: request.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Chat request failed" }, { status: 500 });
  }
}
