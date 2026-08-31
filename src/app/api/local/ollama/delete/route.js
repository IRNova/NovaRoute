import { NextResponse } from "next/server";
import { getOllamaBaseUrl, isValidOllamaModelName } from "@/lib/localOllama";

/**
 * POST /api/local/ollama/delete  { model }
 * Removes an installed model from the local Ollama daemon.
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
  try {
    const res = await fetch(`${base}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return NextResponse.json({ error: `Delete failed (${res.status}): ${detail}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: `Ollama is not reachable at ${base}` }, { status: 502 });
  }
}
