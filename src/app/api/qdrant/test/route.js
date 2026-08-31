import { NextResponse } from "next/server";

// POST /api/qdrant/test — probe a Qdrant instance for the Semantic Cache page.
export async function POST(request) {
  try {
    const { host = "localhost", port = "6333", apiKey = "" } = await request.json();
    const hostStr = String(host).trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!/^[\w.-]+$/.test(hostStr) || !/^\d{1,5}$/.test(String(port))) {
      return NextResponse.json({ success: false, error: "Invalid host/port" }, { status: 400 });
    }
    const headers = {};
    if (apiKey) headers["api-key"] = String(apiKey);
    const res = await fetch(`http://${hostStr}:${port}/collections`, {
      headers,
      signal: AbortSignal.timeout(4000),
    });
    return NextResponse.json({ success: res.ok, status: res.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
