import { placeholderRead, placeholderWrite } from "@/lib/api/placeholder.js";

export async function GET() {
  return placeholderRead({
    enabled: false,
    cloudUrl: "",
    lastSync: null,
    status: "disabled",
  });
}

export async function PATCH() {
  return placeholderWrite("Cloud sync");
}

export async function POST() {
  return placeholderWrite("Cloud sync");
}
