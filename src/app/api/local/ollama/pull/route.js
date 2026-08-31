import { NextResponse } from "next/server";
import { getOllamaBaseUrl, isValidOllamaModelName } from "@/lib/localOllama";

/**
 * POST /api/local/ollama/pull  { model }
 * Streams Ollama's NDJSON pull progress straight through to the browser so
 * the UI can render live download progress without polling.
 */
export async function POST(request) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const model = typeof body?.model === "string" ? body.model.trim() : "";
  if (!isValidOllamaModelName(model)) {
    return NextResponse.json({ error: "Invalid model name" }, { status: 400 });
  }

  const base = await getOllamaBaseUrl();
  let upstream;
  try {
    upstream = await fetch(`${base}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Ollama is not reachable at ${base}: ${String(err?.message || err)}` },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      detail = (await upstream.text()).slice(0, 400);
    } catch {}
    return NextResponse.json({ error: `Ollama pull failed (${upstream.status}): ${detail}` }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
