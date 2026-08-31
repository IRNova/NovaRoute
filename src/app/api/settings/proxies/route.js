import { placeholderRead, placeholderWrite } from "@/lib/api/placeholder.js";

export async function GET() {
  return placeholderRead({ proxies: [] });
}

export async function PATCH() {
  return placeholderWrite("Proxy list editing");
}
