import { NextResponse } from "next/server";
import { detectLocalRuntimes } from "open-sse/local/detector.js";

/**
 * GET /api/local/runtimes
 * Detect local AI runtimes (Ollama / LM Studio / llama.cpp) + their models.
 */
export async function GET() {
  try {
    const runtimes = await detectLocalRuntimes({ noCache: true });
    return NextResponse.json({ runtimes });
  } catch (error) {
    console.error("Error detecting local runtimes:", error);
    return NextResponse.json({ error: "Failed to detect local runtimes" }, { status: 500 });
  }
}
