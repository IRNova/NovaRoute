import { placeholderRead, placeholderWrite } from "@/lib/api/placeholder.js";

export async function GET() {
  return placeholderRead({
    stats: {
      ratio: 0,
      bytesSaved: 0,
      requestsCompressed: 0,
      totalRequests: 0,
      method: "gzip",
      enabled: false,
      recentRequests: [],
    },
  });
}

export async function PATCH() {
  return placeholderWrite("Response compression");
}
