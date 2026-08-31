import { NextResponse } from "next/server";
import { renderPrometheusMetrics } from "@/lib/monitoring/prometheus.js";
import { requireManagementAuth } from "@/lib/requireManagementAuth";
import { timingSafeEqualStr } from "@/lib/auth/timingSafe";

export const dynamic = "force-dynamic";

// GET /api/metrics — Prometheus exposition.
//
// Prometheus cannot log into a dashboard, so this accepts either the normal
// management auth (session / CLI token / manage-scoped key) or a dedicated
// bearer token in METRICS_TOKEN. It is never anonymous: request counts, model
// names and spend are business data.
export async function GET(request) {
  const expected = process.env.METRICS_TOKEN;
  if (expected) {
    const header = request.headers.get("authorization") || "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-metrics-token") || "";
    if (provided && timingSafeEqualStr(provided, expected)) {
      return renderResponse();
    }
  }

  const rejection = await requireManagementAuth(request);
  if (rejection) return rejection;
  return renderResponse();
}

async function renderResponse() {
  try {
    const body = await renderPrometheusMetrics();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
