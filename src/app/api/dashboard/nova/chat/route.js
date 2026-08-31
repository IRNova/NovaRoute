import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { runNovaTurn } from "@/lib/nova/orchestrator.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/dashboard/nova/chat
 * Body: { sessionId, text }
 * Streams the multi-agent turn as SSE events:
 * message | task | task_update | review | status | error | done
 */
export async function POST(request) {
  console.error("[chat] HIT");
  try {
    const rejection = await requireManagementAuth(request);
    if (rejection) { console.error("[chat] auth rejected"); return rejection; }
  } catch (authErr) {
    console.error("[chat] AUTH THREW:", authErr?.stack || authErr);
    return new Response(JSON.stringify({ error: "auth failed" }), { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionId = String(body.sessionId || "").trim();
  const text = String(body.text || "").trim();
  const targetAgentId = String(body.targetAgentId || "").trim();
  if (!sessionId || !text) {
    return new Response(JSON.stringify({ error: "sessionId and text are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await runNovaTurn({ sessionId, text, targetAgentId, onEvent: send });
      } catch (error) {
        console.error("[nova-turn] failed:", error?.stack || error);
        send({ type: "error", error: error?.message || "Nova turn failed" });
      } finally {
        send({ type: "done" });
        closed = true;
        try {
          controller.close();
        } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
