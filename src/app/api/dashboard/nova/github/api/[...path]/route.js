import { NextResponse } from "next/server";
import { getGitHubToken } from "@/lib/nova/github.js";

// Proxy all GitHub API calls through the server
// GET/POST/PUT/DELETE /api/dashboard/nova/github/api/[...path]
export async function GET(request, { params }) {
  return proxyGitHub(request, params, "GET");
}

export async function POST(request, { params }) {
  return proxyGitHub(request, params, "POST");
}

export async function PUT(request, { params }) {
  return proxyGitHub(request, params, "PUT");
}

export async function DELETE(request, { params }) {
  return proxyGitHub(request, params, "DELETE");
}

export async function PATCH(request, { params }) {
  return proxyGitHub(request, params, "PATCH");
}

async function proxyGitHub(request, params, method) {
  try {
    const token = await getGitHubToken();
    if (!token) {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 401 });
    }

    const { path } = await params;
    const pathStr = Array.isArray(path) ? path.join("/") : path;
    const url = `https://api.github.com/${pathStr}`;

    const fetchOptions = {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
        "User-Agent": "NovaRoute-Bot",
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
        fetchOptions.headers["Content-Type"] = "application/json";
      } else if (contentType) {
        fetchOptions.body = await request.arrayBuffer();
        fetchOptions.headers["Content-Type"] = contentType;
      }
    }

    const res = await fetch(fullUrl, fetchOptions);

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await res.json().catch(() => null);

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err.message || "GitHub proxy failed" }, { status: 500 });
  }
}
