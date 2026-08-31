import { NextResponse } from "next/server";
import { getCloudflareToken } from "@/lib/nova/cloudflare.js";

// Proxy all Cloudflare API calls through the server
export async function GET(request, { params }) {
  return proxyCloudflare(request, params, "GET");
}

export async function POST(request, { params }) {
  return proxyCloudflare(request, params, "POST");
}

export async function PUT(request, { params }) {
  return proxyCloudflare(request, params, "PUT");
}

export async function DELETE(request, { params }) {
  return proxyCloudflare(request, params, "DELETE");
}

export async function PATCH(request, { params }) {
  return proxyCloudflare(request, params, "PATCH");
}

async function proxyCloudflare(request, params, method) {
  try {
    const token = await getCloudflareToken();
    if (!token) {
      return NextResponse.json({ error: "Cloudflare not connected" }, { status: 401 });
    }

    const { path } = await params;
    const pathStr = Array.isArray(path) ? path.join("/") : path;
    const url = `https://api.cloudflare.com/client/v4/${pathStr}`;

    const fetchOptions = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    // Forward query params
    const requestUrl = new URL(request.url);
    const qs = requestUrl.searchParams.toString();
    const fullUrl = qs ? `${url}?${qs}` : url;

    // Forward body for non-GET/HEAD methods
    if (method !== "GET" && method !== "HEAD") {
      const contentType = request.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        fetchOptions.body = await request.text();
      } else if (contentType) {
        fetchOptions.body = await request.arrayBuffer();
        fetchOptions.headers["Content-Type"] = contentType;
      }
    }

    const res = await fetch(fullUrl, fetchOptions);
    const data = await res.json().catch(() => null);

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Cloudflare proxy failed" }, { status: 500 });
  }
}
