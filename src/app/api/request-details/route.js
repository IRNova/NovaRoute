import { NextResponse } from "next/server";
import { getRequestDetails } from "@/lib/usageDb";

// Translator step inspector — REAL captures from the requestDetails ledger
// (populated when ENABLE_REQUEST_LOGS / observability is on).
//
// ?file=1_req_client.json … 7_res_client.txt → mapped capture slices
// ?stream=true → SSE emitting the latest capture id whenever a new request lands.
const STEP_MAP = {
  "1_req_client.json": (d) => ({ provider: d.provider, model: d.model, _sourceFormat: null, ...safeParse(d.request) }),
  "2_req_source.json": (d) => safeParse(d.request),
  "3_req_openai.json": (d) => safeParse(d.providerRequest),
  "4_req_target.json": (d) => safeParse(d.providerRequest),
  "5_res_provider.txt": (d) => safeString(d.providerResponse),
  "6_res_openai.txt": (d) => safeString(d.response),
  "7_res_client.txt": (d) => safeString(d.response),
};

function safeParse(v) {
  if (v == null) return {};
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return { raw: String(v).slice(0, 4000) }; }
}
function safeString(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, 20000);
  try { return JSON.stringify(v, null, 2).slice(0, 20000); } catch { return ""; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("stream") === "true") {
    const encoder = new TextEncoder();
    let lastId = null;
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode("retry: 3000\n\n"));
        const tick = async () => {
          try {
            const result = await getRequestDetails({ page: 1, pageSize: 1 });
            const latest = result?.details?.[0];
            if (latest && latest.id !== lastId) {
              lastId = latest.id;
              const payload = JSON.stringify({
                id: latest.id,
                provider: latest.provider,
                model: latest.model,
                status: latest.status,
                timestamp: latest.timestamp,
              });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          } catch { /* keep the stream alive */ }
        };
        await tick();
        setInterval(tick, 1500);
      },
      cancel() { /* interval is cleaned up when the stream is GC'd with its controller */ },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
  }

  try {
    const file = searchParams.get("file");
    if (!file || !STEP_MAP[file]) {
      return NextResponse.json({});
    }
    const result = await getRequestDetails({ page: 1, pageSize: 1 });
    const latest = result?.details?.[0];
    if (!latest) return NextResponse.json({});
    return NextResponse.json(STEP_MAP[file](latest));
  } catch {
    return NextResponse.json({});
  }
}
