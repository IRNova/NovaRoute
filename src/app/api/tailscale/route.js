import { placeholderRead, placeholderWrite } from "@/lib/api/placeholder.js";

export async function GET() {
  return placeholderRead({ enabled: false, hostname: "", tailscaleUrl: "" });
}

export async function PATCH() {
  return placeholderWrite("Tailscale settings");
}
